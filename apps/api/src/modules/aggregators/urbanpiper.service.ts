import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
  UnauthorizedException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomBytes } from "crypto";
import {
  buildUrbanPiperCataloguePayload,
  isUrbanPiperCancelState,
  normalizeUrbanPiperOrder,
  parseUrbanPiperRiderWebhook,
  parseUrbanPiperStatusWebhook,
  shouldPushUrbanPiperStatus,
  UP_MODIFIER_PREFIX,
  UP_VARIANT_PREFIX,
  UrbanPiperClient,
  urbanPiperStatusFor,
  type UrbanPiperCredentials,
  type UrbanPiperOrderStatus,
  type UrbanPiperOutletConfig,
  type UrbanPiperPlatform,
} from "@cullinos/integrations";
import { isAlcoholProductType } from "@cullinos/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../common/redis/redis.service";
import { toPaise } from "../../common/money.util";
import { WebsocketGateway } from "../../websocket/websocket.gateway";
import type { IncomingOrderItem } from "../../common/order-items.util";
import { OrdersService } from "../orders/orders.service";
import { OrderStatusNotifier, type OrderStatusChange } from "../orders/order-status.notifier";
import { MenuChangeNotifier, type MenuItemAvailabilityChange } from "../menu/menu-change.notifier";
import { secretsMatch } from "./aggregators.service";
import {
  enabledPlatforms,
  parseMode,
  parsePrepTime,
  parseUrbanPiperConfig,
  readUrbanPiperMeta,
  recordUnmappedItems,
  redactUrbanPiperConfig,
  serializeUrbanPiperConfig,
  URBANPIPER_PROVIDER,
  MAX_ACCEPT_TIMEOUT_MINUTES,
  MIN_PREP_TIME_MINUTES,
  type ParsedUrbanPiperConfig,
  type UrbanPiperOrderMeta,
} from "./urbanpiper-config.util";

const TIMEOUT_INTERVAL_MS = 30_000;
const TIMEOUT_LOCK_KEY = "job-lock:urbanpiper-accept-timeout";
const MENU_PUSH_DEBOUNCE_MS = 60_000;
const ACTIVE_STATUSES = ["draft", "confirmed", "preparing", "ready"] as const;
const TERMINAL_STATUSES = ["completed", "cancelled", "voided"];

export type UrbanPiperSettingsInput = {
  isActive?: boolean;
  username?: string;
  apiKey?: string;
  mode?: string;
  acceptTimeoutMinutes?: number;
  autoRejectOnTimeout?: boolean;
  defaultPrepTimeMinutes?: number;
  autoPushMenu?: boolean;
};

export type UrbanPiperOutletInput = {
  connected?: boolean;
  storeRefId?: string | null;
  platforms?: Partial<Record<UrbanPiperPlatform, boolean>>;
};

type OrderRow = {
  id: string;
  organizationId: string;
  outletId: string;
  orderNumber: string;
  status: string;
  total: Prisma.Decimal | number;
  customerName: string | null;
  notes: string | null;
  createdAt: Date;
  metadata: Prisma.JsonValue | null;
  items?: Array<{
    id: string;
    name: string;
    quantity: number;
    notes: string | null;
    modifiers: Prisma.JsonValue | null;
    unitPrice: Prisma.Decimal | number;
  }>;
};

function platformLabel(platform: string) {
  if (platform === "swiggy") return "Swiggy";
  if (platform === "zomato") return "Zomato";
  return "Aggregator";
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

@Injectable()
export class UrbanPiperService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UrbanPiperService.name);
  private timer?: ReturnType<typeof setInterval>;
  private readonly menuPushTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private prisma: PrismaService,
    private orders: OrdersService,
    private ws: WebsocketGateway,
    @Optional() private statusNotifier?: OrderStatusNotifier,
    @Optional() private menuNotifier?: MenuChangeNotifier,
    @Optional() private redis?: RedisService,
  ) {}

  onModuleInit() {
    this.statusNotifier?.register((change) => this.onOrderStatusChanged(change));
    this.menuNotifier?.register({
      onMenuItemsAvailability: (orgId, changes) => this.onMenuItemsAvailability(orgId, changes),
      onMenuChanged: (orgId) => this.scheduleMenuPush(orgId),
    });
    if (process.env.NODE_ENV === "test") return;
    this.timer = setInterval(() => void this.runTimeoutPass(), TIMEOUT_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    for (const t of this.menuPushTimers.values()) clearTimeout(t);
    this.menuPushTimers.clear();
  }

  /** Overridable for tests. */
  protected createClient(creds: UrbanPiperCredentials) {
    return new UrbanPiperClient(creds);
  }

  // -------------------------------------------------------------------------
  // Settings
  // -------------------------------------------------------------------------

  private getIntegration(orgId: string) {
    return this.prisma.integration.findFirst({
      where: { organizationId: orgId, provider: URBANPIPER_PROVIDER },
    });
  }

  private async load(orgId: string) {
    const row = await this.getIntegration(orgId);
    return { row, config: parseUrbanPiperConfig(row?.config) };
  }

  private async save(orgId: string, config: ParsedUrbanPiperConfig, isActive?: boolean) {
    const existing = await this.getIntegration(orgId);
    const data = {
      config: serializeUrbanPiperConfig(config),
      isActive: isActive ?? existing?.isActive ?? false,
    };
    return existing
      ? this.prisma.integration.update({ where: { id: existing.id }, data })
      : this.prisma.integration.create({
          data: { organizationId: orgId, provider: URBANPIPER_PROVIDER, ...data },
        });
  }

  async getSettings(orgId: string) {
    const { row, config } = await this.load(orgId);
    return redactUrbanPiperConfig(orgId, row?.isActive ?? false, config);
  }

  async updateSettings(orgId: string, input: UrbanPiperSettingsInput) {
    const { row, config } = await this.load(orgId);
    if (input.username !== undefined) config.username = input.username.trim();
    if (input.apiKey?.trim()) config.apiKey = input.apiKey.trim();
    if (input.mode !== undefined) config.mode = parseMode(input.mode);
    if (input.acceptTimeoutMinutes !== undefined) {
      const n = Number(input.acceptTimeoutMinutes);
      if (!Number.isInteger(n) || n < 0 || n > MAX_ACCEPT_TIMEOUT_MINUTES) {
        throw new BadRequestException(
          `acceptTimeoutMinutes must be a whole number between 0 and ${MAX_ACCEPT_TIMEOUT_MINUTES}`,
        );
      }
      config.acceptTimeoutMinutes = n;
    }
    if (input.autoRejectOnTimeout !== undefined) {
      config.autoRejectOnTimeout = Boolean(input.autoRejectOnTimeout);
    }
    if (input.defaultPrepTimeMinutes !== undefined) {
      config.defaultPrepTimeMinutes = parsePrepTime(
        input.defaultPrepTimeMinutes,
        config.defaultPrepTimeMinutes,
      );
    }
    if (input.autoPushMenu !== undefined) config.autoPushMenu = Boolean(input.autoPushMenu);

    const isActive = input.isActive ?? row?.isActive ?? false;
    if (isActive && (!config.username || !config.apiKey)) {
      throw new BadRequestException("Enter the UrbanPiper username and API key before enabling");
    }

    let revealed: string | undefined;
    if (!config.webhookSecret) {
      config.webhookSecret = randomBytes(24).toString("hex");
      revealed = config.webhookSecret;
    }
    const saved = await this.save(orgId, config, isActive);
    return redactUrbanPiperConfig(orgId, saved.isActive, config, { webhookSecret: revealed });
  }

  async regenerateWebhookSecret(orgId: string) {
    const { row, config } = await this.load(orgId);
    config.webhookSecret = randomBytes(24).toString("hex");
    const saved = await this.save(orgId, config, row?.isActive ?? false);
    return redactUrbanPiperConfig(orgId, saved.isActive, config, {
      webhookSecret: config.webhookSecret,
    });
  }

  private async assertOutlet(orgId: string, outletId: string) {
    const outlet = await this.prisma.outlet.findFirst({
      where: { id: outletId, organizationId: orgId },
      select: { id: true, name: true },
    });
    if (!outlet) throw new NotFoundException("Outlet not found");
    return outlet;
  }

  async updateOutlet(orgId: string, outletId: string, input: UrbanPiperOutletInput) {
    await this.assertOutlet(orgId, outletId);
    const { row, config } = await this.load(orgId);
    const current: UrbanPiperOutletConfig = config.outlets[outletId] ?? {
      connected: false,
      platforms: { swiggy: true, zomato: true },
      disabledItemIds: [],
      storeOnline: true,
      itemSkuMap: {},
    };
    if (input.storeRefId !== undefined) {
      const ref = input.storeRefId?.trim() || undefined;
      if (ref) {
        const clash = Object.entries(config.outlets).find(
          ([id, o]) => id !== outletId && (o.storeRefId ?? id) === ref,
        );
        if (clash) throw new BadRequestException("Another outlet already uses this store ref id");
      }
      current.storeRefId = ref;
    }
    if (input.connected !== undefined) current.connected = Boolean(input.connected);
    if (input.platforms) {
      current.platforms = {
        swiggy: input.platforms.swiggy ?? current.platforms.swiggy,
        zomato: input.platforms.zomato ?? current.platforms.zomato,
      };
    }
    config.outlets[outletId] = current;
    const saved = await this.save(orgId, config, row?.isActive ?? false);
    return redactUrbanPiperConfig(orgId, saved.isActive, config);
  }

  private async requireClient(orgId: string) {
    const { row, config } = await this.load(orgId);
    if (!row?.isActive) throw new BadRequestException("UrbanPiper integration is not active");
    if (!config.username || !config.apiKey) {
      throw new BadRequestException("UrbanPiper credentials are not configured");
    }
    const client = this.createClient({
      username: config.username,
      apiKey: config.apiKey,
      mode: config.mode,
    });
    return { client, config };
  }

  private connectedOutlet(config: ParsedUrbanPiperConfig, outletId: string) {
    const outlet = config.outlets[outletId];
    if (!outlet?.connected) throw new BadRequestException("Outlet is not connected to UrbanPiper");
    return { outlet, storeRefId: outlet.storeRefId ?? outletId };
  }

  // -------------------------------------------------------------------------
  // Menu, item and store availability
  // -------------------------------------------------------------------------

  async pushMenu(orgId: string, outletId: string) {
    await this.assertOutlet(orgId, outletId);
    const { client, config } = await this.requireClient(orgId);
    const { outlet, storeRefId } = this.connectedOutlet(config, outletId);

    const [categories, items] = await Promise.all([
      this.prisma.menuCategory.findMany({
        where: { organizationId: orgId, isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, description: true, sortOrder: true },
      }),
      this.prisma.menuItem.findMany({
        where: { organizationId: orgId, isActive: true },
        orderBy: { sortOrder: "asc" },
        take: 2000,
        include: {
          variants: { orderBy: { sortOrder: "asc" } },
          modifierGroups: {
            include: {
              modifierGroup: { include: { modifiers: { orderBy: { sortOrder: "asc" } } } },
            },
          },
          outletPrices: { where: { outletId, priceType: "retail" } },
        },
      }),
    ]);

    const disabled = new Set(outlet.disabledItemIds ?? []);
    const sellable = items.filter((i) => !isAlcoholProductType(i.productType));
    const payload = buildUrbanPiperCataloguePayload({
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        sortOrder: c.sortOrder,
      })),
      items: sellable.map((item) => {
        const outletPrice = item.outletPrices[0];
        return {
          id: item.id,
          name: item.name,
          description: item.description,
          price: outletPrice ? Number(outletPrice.price) : Number(item.basePrice),
          categoryId: item.categoryId,
          isVeg: item.isVeg,
          imageUrl: item.imageUrl,
          sortOrder: item.sortOrder,
          available:
            item.onlineAvailable && outletPrice?.isAvailable !== false && !disabled.has(item.id),
          variants: item.variants.map((v) => ({
            id: v.id,
            name: v.name,
            price: Number(v.price),
            isDefault: v.isDefault,
          })),
          modifierGroups: item.modifierGroups.map((link) => ({
            id: link.modifierGroup.id,
            name: link.modifierGroup.name,
            minSelect: link.modifierGroup.minSelect,
            maxSelect: link.modifierGroup.maxSelect,
            modifiers: link.modifierGroup.modifiers.map((m) => ({
              id: m.id,
              name: m.name,
              price: Number(m.price),
            })),
          })),
        };
      }),
    });

    const now = new Date().toISOString();
    try {
      await client.pushCatalogue(storeRefId, payload);
    } catch (err) {
      await this.updateOutletState(orgId, outletId, {
        lastMenuPushAt: now,
        lastMenuPushError: errorMessage(err),
      });
      throw new BadRequestException(`Menu push failed: ${errorMessage(err)}`);
    }
    await this.updateOutletState(orgId, outletId, { lastMenuPushAt: now, lastMenuPushError: null });
    return {
      ok: true,
      items: payload.items.length,
      categories: payload.categories.length,
      skippedAlcohol: items.length - sellable.length,
      pushedAt: now,
    };
  }

  private async updateOutletState(
    orgId: string,
    outletId: string,
    patch: Partial<UrbanPiperOutletConfig>,
  ) {
    const { row, config } = await this.load(orgId);
    const current = config.outlets[outletId];
    if (!current) return;
    config.outlets[outletId] = { ...current, ...patch };
    await this.save(orgId, config, row?.isActive ?? false);
  }

  private scheduleMenuPush(orgId: string) {
    const existing = this.menuPushTimers.get(orgId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.menuPushTimers.delete(orgId);
      void this.autoPushMenu(orgId);
    }, MENU_PUSH_DEBOUNCE_MS);
    this.menuPushTimers.set(orgId, timer);
  }

  private async autoPushMenu(orgId: string) {
    const { row, config } = await this.load(orgId);
    if (!row?.isActive || !config.autoPushMenu || !config.apiKey) return;
    for (const [outletId, outlet] of Object.entries(config.outlets)) {
      if (!outlet.connected) continue;
      await this.pushMenu(orgId, outletId).catch((err) =>
        this.logger.warn(`Auto menu push failed for outlet ${outletId}: ${errorMessage(err)}`),
      );
    }
  }

  async setItemsAvailability(
    orgId: string,
    outletId: string,
    itemIds: string[],
    available: boolean,
  ) {
    if (!Array.isArray(itemIds) || !itemIds.length) {
      throw new BadRequestException("itemIds is required");
    }
    await this.assertOutlet(orgId, outletId);
    const owned = await this.prisma.menuItem.count({
      where: { id: { in: itemIds }, organizationId: orgId },
    });
    if (owned !== new Set(itemIds).size) throw new BadRequestException("Invalid menu item id");

    const { client, config } = await this.requireClient(orgId);
    const { outlet, storeRefId } = this.connectedOutlet(config, outletId);
    await client
      .setItemsAvailability(storeRefId, itemIds, available, enabledPlatforms(outlet))
      .catch((err) => {
        throw new BadRequestException(`UrbanPiper item update failed: ${errorMessage(err)}`);
      });

    const disabled = new Set(outlet.disabledItemIds ?? []);
    for (const id of itemIds) {
      if (available) disabled.delete(id);
      else disabled.add(id);
    }
    await this.updateOutletState(orgId, outletId, { disabledItemIds: [...disabled] });
    return { ok: true, disabledItemIds: [...disabled] };
  }

  private async onMenuItemsAvailability(orgId: string, changes: MenuItemAvailabilityChange[]) {
    const { row, config } = await this.load(orgId);
    if (!row?.isActive || !config.apiKey) return;
    const client = this.createClient({
      username: config.username,
      apiKey: config.apiKey,
      mode: config.mode,
    });
    for (const [outletId, outlet] of Object.entries(config.outlets)) {
      if (!outlet.connected) continue;
      const storeRefId = outlet.storeRefId ?? outletId;
      const disabled = new Set(outlet.disabledItemIds ?? []);
      for (const available of [true, false]) {
        const ids = changes
          .filter((c) => c.availableOnline === available && !(available && disabled.has(c.id)))
          .map((c) => c.id);
        if (!ids.length) continue;
        await client
          .setItemsAvailability(storeRefId, ids, available, enabledPlatforms(outlet))
          .catch((err) =>
            this.logger.warn(`Item availability sync failed for outlet ${outletId}: ${errorMessage(err)}`),
          );
      }
    }
  }

  async setStoreOnline(orgId: string, outletId: string, online: boolean) {
    await this.assertOutlet(orgId, outletId);
    const { client, config } = await this.requireClient(orgId);
    const { outlet, storeRefId } = this.connectedOutlet(config, outletId);
    await client
      .setStoreAvailability(storeRefId, online, enabledPlatforms(outlet))
      .catch((err) => {
        throw new BadRequestException(`UrbanPiper store update failed: ${errorMessage(err)}`);
      });
    await this.updateOutletState(orgId, outletId, { storeOnline: online });
    return { ok: true, storeOnline: online };
  }

  async mapItem(
    orgId: string,
    outletId: string,
    externalItemId: string,
    menuItemId: string | null,
  ) {
    if (!externalItemId?.trim()) throw new BadRequestException("externalItemId is required");
    await this.assertOutlet(orgId, outletId);
    if (menuItemId) {
      const item = await this.prisma.menuItem.findFirst({
        where: { id: menuItemId, organizationId: orgId },
        select: { id: true },
      });
      if (!item) throw new BadRequestException("Invalid menu item id");
    }
    const { row, config } = await this.load(orgId);
    const outlet = config.outlets[outletId];
    if (!outlet) throw new BadRequestException("Outlet is not connected to UrbanPiper");
    const skuMap = { ...(outlet.itemSkuMap ?? {}) };
    if (menuItemId) skuMap[externalItemId] = menuItemId;
    else delete skuMap[externalItemId];
    outlet.itemSkuMap = skuMap;
    if (menuItemId) {
      config.unmappedItems = (config.unmappedItems ?? []).filter(
        (u) => !(u.externalItemId === externalItemId && u.outletId === outletId),
      );
    }
    const saved = await this.save(orgId, config, row?.isActive ?? false);
    return redactUrbanPiperConfig(orgId, saved.isActive, config);
  }

  // -------------------------------------------------------------------------
  // Webhooks
  // -------------------------------------------------------------------------

  private async authenticateWebhook(orgId: string, secret: string | undefined) {
    const { row, config } = await this.load(orgId);
    if (!row?.isActive) throw new UnauthorizedException("UrbanPiper not connected");
    if (!secretsMatch(secret, config.webhookSecret)) {
      throw new UnauthorizedException("Invalid webhook secret");
    }
    return config;
  }

  private findOrderByUpId(orgId: string, upOrderId: string) {
    return this.prisma.order.findFirst({
      where: {
        organizationId: orgId,
        idempotencyKey: `urbanpiper:${upOrderId}`,
      },
    });
  }

  async ingestOrder(orgId: string, secret: string | undefined, payload: unknown) {
    const config = await this.authenticateWebhook(orgId, secret);
    const normalized = normalizeUrbanPiperOrder(payload);
    if (!normalized.upOrderId) throw new BadRequestException("Order id missing");
    if (!normalized.items.length) throw new BadRequestException("Order has no items");

    const existing = await this.findOrderByUpId(orgId, normalized.upOrderId);
    if (existing) return { ok: true, orderId: existing.id, duplicate: true };

    const outletEntry = Object.entries(config.outlets).find(
      ([id, o]) => o.connected && (o.storeRefId ?? id) === normalized.storeRefId,
    );
    if (!outletEntry) throw new BadRequestException("No connected outlet matches this store");
    const [outletId, outletCfg] = outletEntry;
    const skuMap = outletCfg.itemSkuMap ?? {};

    const candidateIds = new Set<string>();
    for (const item of normalized.items) {
      if (item.merchantId) candidateIds.add(item.merchantId);
      for (const key of [item.externalItemId, item.merchantId]) {
        if (key && skuMap[key]) candidateIds.add(skuMap[key]);
      }
    }
    const menuItems = candidateIds.size
      ? await this.prisma.menuItem.findMany({
          where: { organizationId: orgId, isActive: true, id: { in: [...candidateIds] } },
          select: {
            id: true,
            variants: { select: { id: true } },
            modifierGroups: {
              select: { modifierGroup: { select: { modifiers: { select: { id: true } } } } },
            },
          },
        })
      : [];
    const menuById = new Map(menuItems.map((m) => [m.id, m]));

    const platform = ["swiggy", "zomato"].includes(normalized.platform)
      ? normalized.platform
      : "aggregator";
    const label = platformLabel(platform);
    const unmapped: Array<{ externalItemId: string; name: string; platform: string; outletId: string }> = [];
    const items: IncomingOrderItem[] = [];
    const priceOverrides: Array<number | undefined> = [];

    for (const item of normalized.items) {
      const mappedId = [
        item.merchantId,
        item.externalItemId && skuMap[item.externalItemId],
        item.merchantId && skuMap[item.merchantId],
      ].find((id): id is string => Boolean(id && menuById.has(id)));

      if (mappedId) {
        const menu = menuById.get(mappedId)!;
        const variantIds = new Set(menu.variants.map((v) => v.id));
        const modifierIds = new Set(
          menu.modifierGroups.flatMap((g) => g.modifierGroup.modifiers.map((m) => m.id)),
        );
        let variantId: string | undefined;
        const modifiers: NonNullable<IncomingOrderItem["modifiers"]> = [];
        for (const opt of item.options) {
          const ref = opt.merchantId ?? "";
          if (ref.startsWith(UP_VARIANT_PREFIX) && variantIds.has(ref.slice(UP_VARIANT_PREFIX.length))) {
            variantId = ref.slice(UP_VARIANT_PREFIX.length);
            continue;
          }
          const modId = ref.startsWith(UP_MODIFIER_PREFIX) ? ref.slice(UP_MODIFIER_PREFIX.length) : "";
          modifiers.push(
            modId && modifierIds.has(modId)
              ? { name: opt.name, price: toPaise(opt.price), modifierId: modId }
              : { name: opt.name, price: toPaise(opt.price) },
          );
        }
        items.push({
          menuItemId: mappedId,
          variantId,
          quantity: item.quantity,
          notes: item.notes,
          modifiers: modifiers.length ? modifiers : undefined,
        });
        priceOverrides.push(item.unitPrice > 0 ? item.unitPrice : undefined);
      } else {
        const optionText = item.options.map((o) => o.name).join(", ");
        items.push({
          name: item.name,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          notes: [optionText, item.notes].filter(Boolean).join(" · ") || undefined,
        });
        priceOverrides.push(undefined);
        unmapped.push({
          externalItemId: item.externalItemId ?? item.merchantId ?? item.name,
          name: item.name,
          platform,
          outletId,
        });
      }
    }

    const now = new Date();
    const meta: UrbanPiperOrderMeta = {
      provider: platform,
      via: "urbanpiper",
      externalOrderId: normalized.upOrderId,
      channelOrderId: normalized.channelOrderId,
      customerPhone: normalized.customerPhone,
      deliveryAddress: normalized.deliveryAddress,
      orderType: normalized.orderType,
      placedAt: normalized.placedAt ?? now.toISOString(),
      acceptBy:
        config.acceptTimeoutMinutes > 0
          ? new Date(now.getTime() + config.acceptTimeoutMinutes * 60_000).toISOString()
          : null,
      unmappedItems: unmapped.map((u) => u.name),
      aggregatorTotal: normalized.total,
    };

    const order = await this.orders.create(
      orgId,
      null,
      {
        outletId,
        source: platform === "aggregator" ? "AGGREGATOR" : platform.toUpperCase(),
        type: "takeaway",
        customerName: normalized.customerName,
        notes:
          [
            `${label} #${normalized.channelOrderId ?? normalized.upOrderId}`,
            normalized.orderType === "takeaway" ? "Customer pickup" : "Rider pickup",
            normalized.instructions,
          ]
            .filter(Boolean)
            .join(" · ") || undefined,
        items,
        idempotencyKey: `urbanpiper:${normalized.upOrderId}`,
        autoConfirm: false,
        metadata: { aggregator: meta },
      },
      {
        priceOverrides,
        prepaid: {
          methodCode: `aggregator_${platform}`,
          methodName: label,
          reference: `${platform}:${normalized.channelOrderId ?? normalized.upOrderId}`,
          tender: platform,
        },
      },
    );

    if (unmapped.length) {
      const fresh = await this.load(orgId);
      fresh.config.unmappedItems = recordUnmappedItems(fresh.config.unmappedItems ?? [], unmapped, now);
      await this.save(orgId, fresh.config, fresh.row?.isActive ?? true).catch((err) =>
        this.logger.warn(`Could not record unmapped items: ${errorMessage(err)}`),
      );
    }

    const summary = await this.getOrderSummary(orgId, order.id);
    this.ws.emitToOutlet(outletId, "aggregator.order.new", summary);
    return { ok: true, orderId: order.id };
  }

  async ingestStatus(orgId: string, secret: string | undefined, payload: unknown) {
    await this.authenticateWebhook(orgId, secret);
    const event = parseUrbanPiperStatusWebhook(payload);
    if (!event) throw new BadRequestException("Invalid status payload");
    const order = await this.findOrderByUpId(orgId, event.upOrderId);
    if (!order) return { ok: true, ignored: "unknown_order" };

    if (isUrbanPiperCancelState(event.newState)) {
      if (!TERMINAL_STATUSES.includes(order.status)) {
        await this.patchMeta(orgId, order.id, {
          platformCancelled: true,
          rejectReason: event.message ?? "Cancelled on aggregator",
          lastPushedStatus: "Cancelled",
        });
        await this.orders.cancel(orgId, order.id, `Cancelled on aggregator: ${event.message ?? ""}`.trim(), {
          refundAuthorized: true,
          externalRefundConfirmed: true,
        });
      }
    } else if (event.newState.toLowerCase() === "completed") {
      await this.patchMeta(orgId, order.id, { lastPushedStatus: "Completed" });
      if (!TERMINAL_STATUSES.includes(order.status) && order.status !== "draft") {
        await this.orders
          .updateStatus(orgId, order.id, "completed", { allowUnpaidComplete: true })
          .catch((err) => this.logger.warn(`Auto-complete failed for ${order.id}: ${errorMessage(err)}`));
      }
    }
    await this.emitUpdated(orgId, order.id);
    return { ok: true };
  }

  async ingestRider(orgId: string, secret: string | undefined, payload: unknown) {
    await this.authenticateWebhook(orgId, secret);
    const event = parseUrbanPiperRiderWebhook(payload);
    if (!event) throw new BadRequestException("Invalid rider payload");
    const order = await this.findOrderByUpId(orgId, event.upOrderId);
    if (!order) return { ok: true, ignored: "unknown_order" };
    await this.patchMeta(orgId, order.id, {
      rider: {
        state: event.state,
        name: event.riderName,
        phone: event.riderPhone,
        updatedAt: new Date().toISOString(),
      },
    });
    await this.emitUpdated(orgId, order.id);
    return { ok: true };
  }

  // -------------------------------------------------------------------------
  // Order lifecycle (staff actions)
  // -------------------------------------------------------------------------

  private async loadUpOrder(orgId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId: orgId },
    });
    if (!order) throw new NotFoundException("Order not found");
    const meta = readUrbanPiperMeta(order.metadata);
    if (!meta) throw new BadRequestException("Not an UrbanPiper order");
    return { order, meta };
  }

  async accept(orgId: string, orderId: string, prepTimeMinutes?: number) {
    const { order } = await this.loadUpOrder(orgId, orderId);
    if (order.status !== "draft") throw new BadRequestException("Order is no longer pending");
    const { config } = await this.load(orgId);
    const prep = parsePrepTime(prepTimeMinutes, config.defaultPrepTimeMinutes);
    await this.patchMeta(orgId, orderId, {
      prepTimeMinutes: prep,
      acceptedAt: new Date().toISOString(),
    });
    await this.orders.confirm(orgId, orderId);
    return this.getOrderSummary(orgId, orderId);
  }

  async reject(orgId: string, orderId: string, reason: string | undefined, userId?: string) {
    const { order } = await this.loadUpOrder(orgId, orderId);
    if (order.status !== "draft" && order.status !== "confirmed") {
      throw new BadRequestException("Only pending or just-accepted orders can be rejected");
    }
    const why = reason?.trim() || "Rejected by restaurant";
    await this.patchMeta(orgId, orderId, { rejectReason: why });
    await this.orders.cancel(orgId, orderId, `Rejected: ${why}`, {
      userId,
      refundAuthorized: true,
      externalRefundConfirmed: true,
    });
    return this.getOrderSummary(orgId, orderId);
  }

  async markReady(orgId: string, orderId: string, userId?: string) {
    const { order } = await this.loadUpOrder(orgId, orderId);
    if (!["confirmed", "preparing"].includes(order.status)) {
      throw new BadRequestException(`Cannot mark a ${order.status} order ready`);
    }
    await this.orders.updateStatus(orgId, orderId, "ready", { userId });
    return this.getOrderSummary(orgId, orderId);
  }

  async markDispatched(orgId: string, orderId: string, userId?: string) {
    const { order } = await this.loadUpOrder(orgId, orderId);
    if (!["confirmed", "preparing", "ready"].includes(order.status)) {
      throw new BadRequestException(`Cannot hand over a ${order.status} order`);
    }
    await this.orders.updateStatus(orgId, orderId, "completed", { userId });
    return this.getOrderSummary(orgId, orderId);
  }

  async retryStatusSync(orgId: string, orderId: string) {
    const { order, meta } = await this.loadUpOrder(orgId, orderId);
    const target = urbanPiperStatusFor(order.status);
    if (!target) throw new BadRequestException("Nothing to sync for this order status");
    await this.pushStatus(orgId, order, meta, target, true);
    return this.getOrderSummary(orgId, orderId);
  }

  private async onOrderStatusChanged(change: OrderStatusChange) {
    const meta = readUrbanPiperMeta(change.metadata);
    if (!meta) return;
    if (meta.platformCancelled) return;
    const target = urbanPiperStatusFor(change.status);
    if (!target) return;
    const fresh = await this.prisma.order.findFirst({
      where: { id: change.id, organizationId: change.organizationId },
    });
    if (!fresh) return;
    const freshMeta = readUrbanPiperMeta(fresh.metadata) ?? meta;
    if (freshMeta.platformCancelled) return;
    await this.pushStatus(change.organizationId, fresh, freshMeta, target, false);
  }

  private async pushStatus(
    orgId: string,
    order: { id: string; outletId: string },
    meta: UrbanPiperOrderMeta,
    target: UrbanPiperOrderStatus,
    force: boolean,
  ) {
    if (
      !force &&
      !shouldPushUrbanPiperStatus(target, meta.lastPushedStatus as UrbanPiperOrderStatus | undefined)
    ) {
      return;
    }
    const message =
      target === "Acknowledged"
        ? `Accepted. Ready in ${meta.prepTimeMinutes ?? MIN_PREP_TIME_MINUTES} min`
        : target === "Cancelled"
          ? meta.rejectReason ?? "Cancelled by restaurant"
          : target;
    const at = new Date().toISOString();
    try {
      const { client } = await this.requireClient(orgId);
      await client.updateOrderStatus(meta.externalOrderId, target, message);
      await this.patchMeta(orgId, order.id, {
        lastPushedStatus: target,
        statusSync: { status: target, ok: true, at },
      });
    } catch (err) {
      const error = errorMessage(err);
      this.logger.warn(`UrbanPiper status ${target} failed for ${order.id}: ${error}`);
      await this.patchMeta(
        orgId,
        order.id,
        { statusSync: { status: target, ok: false, error, at } },
        { event: "aggregator.status_sync_failed", metadata: { status: target, error } },
      );
    }
    await this.emitUpdated(orgId, order.id);
  }

  // -------------------------------------------------------------------------
  // Accept timeout
  // -------------------------------------------------------------------------

  private async runTimeoutPass() {
    const leased = await (this.redis?.acquireLock(TIMEOUT_LOCK_KEY, TIMEOUT_INTERVAL_MS - 5_000) ??
      Promise.resolve(true)).catch(() => false);
    if (!leased) return;
    try {
      await this.expirePendingOrders();
    } catch (err) {
      this.logger.error(`UrbanPiper accept-timeout pass failed: ${errorMessage(err)}`);
    }
  }

  async expirePendingOrders(now = new Date()) {
    const pending = await this.prisma.order.findMany({
      where: {
        status: "draft",
        metadata: { path: ["aggregator", "via"], equals: "urbanpiper" },
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    const configs = new Map<string, ParsedUrbanPiperConfig>();
    const counts = { rejected: 0, alerted: 0 };
    for (const order of pending) {
      const meta = readUrbanPiperMeta(order.metadata);
      if (!meta?.acceptBy || new Date(meta.acceptBy).getTime() > now.getTime()) continue;
      let config = configs.get(order.organizationId);
      if (!config) {
        config = (await this.load(order.organizationId)).config;
        configs.set(order.organizationId, config);
      }
      try {
        if (config.autoRejectOnTimeout) {
          await this.reject(order.organizationId, order.id, "Not accepted in time");
          counts.rejected++;
        } else if (!meta.timeoutAlertedAt) {
          await this.patchMeta(order.organizationId, order.id, { timeoutAlertedAt: now.toISOString() });
          const summary = await this.getOrderSummary(order.organizationId, order.id);
          this.ws.emitToOutlet(order.outletId, "aggregator.order.timeout", summary);
          await this.prisma.notification.create({
            data: {
              organizationId: order.organizationId,
              title: `${platformLabel(meta.provider)} order #${order.orderNumber} not accepted`,
              body: "Accept or reject it now. The aggregator may cancel it automatically.",
              metadata: { type: "aggregator.order.timeout", outletId: order.outletId, orderId: order.id },
            },
          });
          counts.alerted++;
        }
      } catch (err) {
        this.logger.warn(`Accept timeout handling failed for ${order.id}: ${errorMessage(err)}`);
      }
    }
    return counts;
  }

  // -------------------------------------------------------------------------
  // Read models
  // -------------------------------------------------------------------------

  async listOrders(orgId: string, outletId: string) {
    await this.assertOutlet(orgId, outletId);
    const recentCutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const rows = await this.prisma.order.findMany({
      where: {
        organizationId: orgId,
        outletId,
        metadata: { path: ["aggregator", "via"], equals: "urbanpiper" },
        OR: [
          { status: { in: [...ACTIVE_STATUSES] } },
          { status: { in: ["completed", "cancelled"] }, updatedAt: { gte: recentCutoff } },
        ],
      },
      include: {
        items: {
          select: { id: true, name: true, quantity: true, notes: true, modifiers: true, unitPrice: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return rows.map((r) => this.toSummary(r as OrderRow));
  }

  async getOrderSummary(orgId: string, orderId: string) {
    const row = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId: orgId },
      include: {
        items: {
          select: { id: true, name: true, quantity: true, notes: true, modifiers: true, unitPrice: true },
        },
      },
    });
    if (!row) throw new NotFoundException("Order not found");
    return this.toSummary(row as OrderRow);
  }

  private toSummary(order: OrderRow) {
    const meta = readUrbanPiperMeta(order.metadata);
    return {
      id: order.id,
      outletId: order.outletId,
      orderNumber: order.orderNumber,
      status: order.status,
      total: Number(order.total),
      customerName: order.customerName,
      notes: order.notes,
      createdAt: order.createdAt.toISOString(),
      items: (order.items ?? []).map((i) => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        notes: i.notes,
        unitPrice: Number(i.unitPrice),
        modifiers: Array.isArray(i.modifiers)
          ? (i.modifiers as Array<{ name?: string }>).map((m) => m?.name).filter(Boolean)
          : [],
      })),
      aggregator: meta
        ? {
            platform: meta.provider,
            externalOrderId: meta.externalOrderId,
            channelOrderId: meta.channelOrderId ?? null,
            orderType: meta.orderType ?? "delivery",
            acceptBy: meta.acceptBy ?? null,
            prepTimeMinutes: meta.prepTimeMinutes ?? null,
            rejectReason: meta.rejectReason ?? null,
            rider: meta.rider ?? null,
            statusSync: meta.statusSync ?? null,
            unmappedItems: meta.unmappedItems ?? [],
          }
        : null,
    };
  }

  private async emitUpdated(orgId: string, orderId: string) {
    const summary = await this.getOrderSummary(orgId, orderId).catch(() => null);
    if (summary) this.ws.emitToOutlet(summary.outletId, "aggregator.order.updated", summary);
  }

  private async patchMeta(
    orgId: string,
    orderId: string,
    patch: Partial<UrbanPiperOrderMeta>,
    timeline?: { event: string; metadata: Record<string, unknown> },
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId: orgId },
      select: { metadata: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    const metadata = (order.metadata ?? {}) as Record<string, unknown>;
    const aggregator = { ...((metadata.aggregator ?? {}) as Record<string, unknown>), ...patch };
    await this.prisma.order.update({
      where: { id: orderId, organizationId: orgId },
      data: {
        metadata: { ...metadata, aggregator } as Prisma.InputJsonValue,
        ...(timeline
          ? { timeline: { create: { event: timeline.event, metadata: timeline.metadata as never } } }
          : {}),
      },
    });
  }
}

