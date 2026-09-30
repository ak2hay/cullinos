import { describe, expect, it } from "vitest";
import { PATH_METADATA } from "@nestjs/common/constants";
import { PERMISSIONS_KEY } from "./decorators/permissions.decorator";
import { IS_PUBLIC_KEY, PLATFORM_PERMISSIONS_KEY } from "./decorators";
import { PLATFORM_PERMISSIONS } from "./platform-permissions";
import { PaymentsController } from "../modules/payments/payments.controller";
import { SubscriptionsController } from "../modules/subscriptions/subscriptions.controller";
import { OrdersController } from "../modules/orders/orders.controller";
import { OrganizationsController } from "../modules/organizations/organizations.controller";
import { PrivacyController } from "../modules/privacy/privacy.controller";
import { SuperAdminController } from "../modules/super-admin/super-admin.controller";
import { PlatformTeamController } from "../modules/super-admin/platform-team.controller";
import { MarketingSuperAdminController } from "../modules/marketing/marketing-super-admin.controller";
import { GuestOpsController } from "../modules/guest/guest-ops.controller";
import { GuestMarketingSuperAdminController } from "../modules/guest/guest-marketing-super-admin.controller";
import { SuperAdminPromoController } from "../modules/promo/super-admin-promo.controller";
import { SuperAdminWalletController } from "../modules/wallet/wallet.controller";

function required(controller: { prototype: object }, handler: string): string[] | undefined {
  const fn = (controller.prototype as Record<string, unknown>)[handler];
  return Reflect.getMetadata(PERMISSIONS_KEY, fn as object) as string[] | undefined;
}

describe("sensitive routes declare role permissions", () => {
  it.each([
    [PaymentsController, "listGateways", "settings:read"],
    [PaymentsController, "getGateway", "settings:read"],
    [PaymentsController, "upsertGateway", "settings:update"],
    [PaymentsController, "upsertOutletGateway", "settings:update"],
    [PaymentsController, "recordCash", "pos:access"],
    [PaymentsController, "createIntent", "pos:access"],
    [PaymentsController, "verify", "pos:access"],
    [SubscriptionsController, "checkout", "org:manage_settings"],
    [SubscriptionsController, "activatePlan", "org:manage_settings"],
    [OrdersController, "applyDiscount", "order:discount"],
    [OrdersController, "cancel", "order:cancel"],
    [OrganizationsController, "updateSettings", "settings:update"],
    [OrganizationsController, "updateCurrent", "settings:update"],
    [PrivacyController, "exportCustomer", "customer:update"],
    [PrivacyController, "eraseCustomer", "customer:update"],
    [PrivacyController, "eraseGuest", "customer:update"],
  ] as const)("%o.%s requires %s", (controller, handler, permission) => {
    expect(required(controller, handler)).toContain(permission);
  });

  it("kitchen staff cannot record payments (no pos:access or order:update)", () => {
    const kitchen = ["kitchen:read", "kitchen:update", "order:read", "menu:read"];
    const needed = required(PaymentsController, "recordCash") ?? [];
    expect(needed.some((p) => kitchen.includes(p))).toBe(false);
  });
});

const PLATFORM_CONTROLLERS = [
  SuperAdminController,
  PlatformTeamController,
  MarketingSuperAdminController,
  GuestOpsController,
  GuestMarketingSuperAdminController,
  SuperAdminPromoController,
  SuperAdminWalletController,
] as const;

function routeHandlers(controller: { prototype: object }): string[] {
  const proto = controller.prototype as Record<string, unknown>;
  return Object.getOwnPropertyNames(proto).filter(
    (name) =>
      name !== "constructor" &&
      typeof proto[name] === "function" &&
      Reflect.getMetadata(PATH_METADATA, proto[name] as object) !== undefined,
  );
}

function platformRequired(controller: { prototype: object }, handler: string): string[] | undefined {
  const fn = (controller.prototype as Record<string, unknown>)[handler] as object;
  return (
    (Reflect.getMetadata(PLATFORM_PERMISSIONS_KEY, fn) as string[] | undefined) ??
    (Reflect.getMetadata(PLATFORM_PERMISSIONS_KEY, controller) as string[] | undefined)
  );
}

describe("super-admin routes declare platform permissions", () => {
  const rows = PLATFORM_CONTROLLERS.flatMap((controller) =>
    routeHandlers(controller).map((handler) => [controller.name, controller, handler] as const),
  );

  it("finds super-admin routes to check", () => {
    expect(rows.length).toBeGreaterThan(50);
  });

  it.each(rows)("%s.%s is public or has a known platform permission", (_name, controller, handler) => {
    const fn = (controller.prototype as Record<string, unknown>)[handler] as object;
    if (Reflect.getMetadata(IS_PUBLIC_KEY, fn)) return;
    const perms = platformRequired(controller, handler);
    expect(perms?.length ?? 0).toBeGreaterThan(0);
    for (const p of perms ?? []) expect(PLATFORM_PERMISSIONS).toContain(p);
  });

  it.each([
    [SuperAdminController, "deleteOrganization", "tenants.delete"],
    [SuperAdminController, "runLabsSql", "labs.sql"],
    [SuperAdminController, "impersonate", "tenants.impersonate"],
    [SuperAdminController, "updateSettingsGroup", "settings.manage"],
    [SuperAdminController, "createPlan", "plans.manage"],
    [SuperAdminController, "manageSubscription", "subscriptions.manage"],
    [SuperAdminWalletController, "adjust", "wallet.manage"],
    [MarketingSuperAdminController, "listInquiries", "marketing.inquiries"],
    [MarketingSuperAdminController, "publish", "marketing.manage"],
    [SuperAdminPromoController, "sendCampaign", "promo.send"],
    [PlatformTeamController, "invite", "team.manage"],
  ] as const)("%o.%s requires %s", (controller, handler, permission) => {
    expect(platformRequired(controller, handler)).toEqual([permission]);
  });
});
