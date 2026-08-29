import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../../prisma/prisma.service";
import { MarketingUploadService } from "./marketing-upload.service";
import {
  DEFAULT_MARKETING_THEME_TOKENS,
  DESIGN_PRESETS,
  MARKETING_IMAGE_SLOTS,
  SLOT_TO_FILENAME,
} from "./marketing.constants";
import * as fs from "fs";
import * as path from "path";

type Status = "draft" | "published";

@Injectable()
export class MarketingService {
  constructor(
    private prisma: PrismaService,
    private upload: MarketingUploadService,
    private jwt: JwtService,
  ) {}

  async getSite() {
    return (
      (await this.prisma.marketingSite.findUnique({ where: { id: "default" } })) ?? {
        id: "default",
        siteName: "Cullinos",
        tagline: "Restaurant Operating System",
      }
    );
  }

  async updateSite(data: Partial<{
    siteName: string;
    tagline: string;
    siteDescription: string;
    registerUrl: string;
    adminUrl: string;
    contactEmail: string;
    seoTitle: string;
    seoDescription: string;
  }>) {
    return this.prisma.marketingSite.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        siteName: data.siteName ?? "Cullinos",
        tagline: data.tagline ?? "Restaurant Operating System",
        ...data,
      },
      update: data,
    });
  }

  listAssets() {
    return this.prisma.marketingAsset.findMany({ orderBy: { createdAt: "desc" } });
  }

  async uploadAsset(file: Express.Multer.File, slotKey?: string, alt?: string, userId?: string) {
    const saved = this.upload.saveUploadedFile(file, slotKey);
    return this.prisma.marketingAsset.create({
      data: {
        filename: saved.filename,
        originalName: file.originalname,
        mimeType: saved.mimeType,
        sizeBytes: saved.sizeBytes,
        url: saved.url,
        alt: alt ?? file.originalname,
        slotKey: slotKey ?? null,
        uploadedById: userId ?? null,
      },
    });
  }

  updateAsset(id: string, data: { alt?: string; slotKey?: string; tags?: string[] }) {
    return this.prisma.marketingAsset.update({ where: { id }, data });
  }

  async deleteAsset(id: string) {
    const asset = await this.prisma.marketingAsset.findUnique({ where: { id } });
    if (asset) this.upload.deleteByUrl(asset.url);
    return this.prisma.marketingAsset.delete({ where: { id } });
  }

  listHeroSlides(status?: Status) {
    return this.prisma.marketingHeroSlide.findMany({
      where: status ? { status } : undefined,
      include: { imageAsset: true },
      orderBy: { sortOrder: "asc" },
    });
  }

  createHeroSlide(data: {
    headline: string;
    headlineAccent: string;
    subline: string;
    imageAssetId?: string;
    imageKey?: string;
    sortOrder?: number;
  }) {
    return this.prisma.marketingHeroSlide.create({
      data: { ...data, status: "draft" },
      include: { imageAsset: true },
    });
  }

  updateHeroSlide(id: string, data: Record<string, unknown>) {
    return this.prisma.marketingHeroSlide.update({
      where: { id },
      data,
      include: { imageAsset: true },
    });
  }

  deleteHeroSlide(id: string) {
    return this.prisma.marketingHeroSlide.delete({ where: { id } });
  }

  listNavItems(status?: Status) {
    return this.prisma.marketingNavItem.findMany({
      where: status ? { status } : undefined,
      orderBy: { sortOrder: "asc" },
    });
  }

  createNavItem(data: { label: string; href: string; groupKey?: string; sortOrder?: number }) {
    return this.prisma.marketingNavItem.create({ data: { ...data, status: "draft" } });
  }

  updateNavItem(id: string, data: Record<string, unknown>) {
    return this.prisma.marketingNavItem.update({ where: { id }, data });
  }

  deleteNavItem(id: string) {
    return this.prisma.marketingNavItem.delete({ where: { id } });
  }

  listPricingCards(status?: Status) {
    return this.prisma.marketingPricingCard.findMany({
      where: status ? { status } : undefined,
      orderBy: { sortOrder: "asc" },
    });
  }

  createPricingCard(data: Record<string, unknown>) {
    return this.prisma.marketingPricingCard.create({ data: { ...data, status: "draft" } as never });
  }

  updatePricingCard(id: string, data: Record<string, unknown>) {
    return this.prisma.marketingPricingCard.update({ where: { id }, data: data as never });
  }

  deletePricingCard(id: string) {
    return this.prisma.marketingPricingCard.delete({ where: { id } });
  }

  listTestimonials(status?: Status) {
    return this.prisma.marketingTestimonial.findMany({
      where: status ? { status } : undefined,
      orderBy: { sortOrder: "asc" },
    });
  }

  createTestimonial(data: { quote: string; author: string; role: string; sortOrder?: number }) {
    return this.prisma.marketingTestimonial.create({ data: { ...data, status: "draft" } });
  }

  updateTestimonial(id: string, data: Record<string, unknown>) {
    return this.prisma.marketingTestimonial.update({ where: { id }, data });
  }

  deleteTestimonial(id: string) {
    return this.prisma.marketingTestimonial.delete({ where: { id } });
  }

  listBlogPosts(status?: Status) {
    return this.prisma.marketingBlogPost.findMany({
      where: status ? { status } : undefined,
      include: { coverAsset: true },
      orderBy: { updatedAt: "desc" },
    });
  }

  createBlogPost(data: {
    slug: string;
    title: string;
    excerpt?: string;
    body: string;
    coverAssetId?: string;
  }) {
    return this.prisma.marketingBlogPost.create({
      data: { ...data, status: "draft" },
      include: { coverAsset: true },
    });
  }

  updateBlogPost(id: string, data: Record<string, unknown>) {
    return this.prisma.marketingBlogPost.update({
      where: { id },
      data,
      include: { coverAsset: true },
    });
  }

  deleteBlogPost(id: string) {
    return this.prisma.marketingBlogPost.delete({ where: { id } });
  }

  listPages(status?: Status) {
    return this.prisma.marketingPage.findMany({
      where: status ? { status } : undefined,
      include: { blocks: true },
      orderBy: { slug: "asc" },
    });
  }

  async upsertPageBlock(pageSlug: string, blockKey: string, content: unknown, sortOrder = 0) {
    const page =
      (await this.prisma.marketingPage.findUnique({ where: { slug: pageSlug } })) ??
      (await this.prisma.marketingPage.create({
        data: { slug: pageSlug, title: pageSlug, status: "draft" },
      }));

    const existing = await this.prisma.marketingBlock.findFirst({
      where: { pageId: page.id, blockKey, status: "draft" },
    });

    if (existing) {
      return this.prisma.marketingBlock.update({
        where: { id: existing.id },
        data: { content: content as object, sortOrder },
      });
    }

    return this.prisma.marketingBlock.create({
      data: {
        pageId: page.id,
        blockKey,
        content: content as object,
        sortOrder,
        status: "draft",
      },
    });
  }

  getTheme(status: Status = "draft") {
    return this.prisma.marketingTheme.findFirst({
      where: { status },
      orderBy: { updatedAt: "desc" },
    });
  }

  async upsertThemeDraft(tokens: Record<string, string>, name = "Default") {
    const existing = await this.getTheme("draft");
    if (existing) {
      return this.prisma.marketingTheme.update({
        where: { id: existing.id },
        data: { tokens, name },
      });
    }
    return this.prisma.marketingTheme.create({
      data: { name, tokens, status: "draft" },
    });
  }

  listDesignPresets() {
    return this.prisma.marketingDesignPreset.findMany({ orderBy: { sortOrder: "asc" } });
  }

  async seedDesignPresets() {
    for (const [i, preset] of DESIGN_PRESETS.entries()) {
      await this.prisma.marketingDesignPreset.upsert({
        where: { slug: preset.slug },
        create: {
          slug: preset.slug,
          name: preset.name,
          description: preset.description,
          themeTokens: preset.themeTokens,
          layoutHints: preset.layoutHints,
          copyTone: preset.copyTone,
          imagePrompts: preset.imagePrompts,
          sortOrder: i,
        },
        update: {
          name: preset.name,
          description: preset.description,
          themeTokens: preset.themeTokens,
          layoutHints: preset.layoutHints,
          copyTone: preset.copyTone,
          imagePrompts: preset.imagePrompts,
          sortOrder: i,
        },
      });
    }
    return this.listDesignPresets();
  }

  async applyDesignPreset(slug: string) {
    const preset = await this.prisma.marketingDesignPreset.findUnique({ where: { slug } });
    if (!preset) throw new Error("Preset not found");
    return this.upsertThemeDraft(preset.themeTokens as Record<string, string>, preset.name);
  }

  suggestCopy(page: string, tone: string) {
    const variants = [
      {
        headline: "Run your restaurant from one place.",
        subline: "POS, kitchen, waiter app, and online orders — unified for modern operations.",
        cta: "Start free trial",
      },
      {
        headline: "The operating system for your restaurant.",
        subline: "One platform for billing, kitchen, staff, and growth — built for India.",
        cta: "Talk to our team",
      },
      {
        headline: "Serve faster. Manage smarter.",
        subline: "Cullinos connects every order channel to your kitchen and back office.",
        cta: "See all features",
      },
    ];
    return variants.map((v, i) => ({ id: i + 1, page, tone, ...v }));
  }

  suggestImagePrompt(slotKey: string, tone: string) {
    const preset = DESIGN_PRESETS.find((p) => p.copyTone === tone) ?? DESIGN_PRESETS[0];
    const prompts = preset.imagePrompts as Record<string, string>;
    return {
      slotKey,
      tone,
      prompt:
        prompts[slotKey] ??
        `Professional ${slotKey} marketing image for restaurant SaaS, ${tone} tone, dark charcoal and gold palette`,
    };
  }

  async publishAll() {
    const now = new Date();

    await this.prisma.marketingHeroSlide.deleteMany({ where: { status: "published" } });
    await this.prisma.marketingNavItem.deleteMany({ where: { status: "published" } });
    await this.prisma.marketingPricingCard.deleteMany({ where: { status: "published" } });
    await this.prisma.marketingTestimonial.deleteMany({ where: { status: "published" } });
    await this.prisma.marketingTheme.deleteMany({ where: { status: "published" } });
    await this.prisma.marketingBlock.deleteMany({ where: { status: "published" } });

    await this.prisma.marketingHeroSlide.updateMany({
      where: { status: "draft" },
      data: { status: "published", publishedAt: now },
    });
    await this.prisma.marketingNavItem.updateMany({
      where: { status: "draft" },
      data: { status: "published", publishedAt: now },
    });
    await this.prisma.marketingPricingCard.updateMany({
      where: { status: "draft" },
      data: { status: "published", publishedAt: now },
    });
    await this.prisma.marketingTestimonial.updateMany({
      where: { status: "draft" },
      data: { status: "published", publishedAt: now },
    });
    await this.prisma.marketingTheme.updateMany({
      where: { status: "draft" },
      data: { status: "published", publishedAt: now },
    });
    await this.prisma.marketingBlock.updateMany({
      where: { status: "draft" },
      data: { status: "published", publishedAt: now },
    });
    await this.prisma.marketingBlogPost.updateMany({
      where: { status: "draft" },
      data: { status: "published", publishedAt: now },
    });

    await this.prisma.marketingSite.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        siteName: "Cullinos",
        tagline: "Restaurant Operating System",
        lastPublishedAt: now,
      },
      update: { lastPublishedAt: now },
    });

    await this.triggerRevalidate();

    return { ok: true, publishedAt: now.toISOString() };
  }

  async getPublishedBundle() {
    const [site, theme, heroSlides, navItems, pricingCards, testimonials, assets, pages] =
      await Promise.all([
        this.getSite(),
        this.getTheme("published"),
        this.listHeroSlides("published"),
        this.listNavItems("published"),
        this.listPricingCards("published"),
        this.listTestimonials("published"),
        this.listAssets(),
        this.prisma.marketingPage.findMany({
          where: { status: "published" },
          include: { blocks: { where: { status: "published" } } },
        }),
      ]);

    const imageMap: Record<string, string> = {};
    for (const asset of assets) {
      if (asset.slotKey) imageMap[asset.slotKey] = asset.url;
    }

    return {
      site,
      theme: theme?.tokens ?? DEFAULT_MARKETING_THEME_TOKENS,
      heroSlides,
      navItems,
      pricingCards,
      testimonials,
      pages,
      imageMap,
      assets,
    };
  }

  async getDraftBundle() {
    const [site, theme, heroSlides, navItems, pricingCards, testimonials, assets] =
      await Promise.all([
        this.getSite(),
        this.getTheme("draft"),
        this.listHeroSlides("draft"),
        this.listNavItems("draft"),
        this.listPricingCards("draft"),
        this.listTestimonials("draft"),
        this.listAssets(),
      ]);

    const imageMap: Record<string, string> = {};
    for (const asset of assets) {
      if (asset.slotKey) imageMap[asset.slotKey] = asset.url;
    }

    return { site, theme: theme?.tokens ?? DEFAULT_MARKETING_THEME_TOKENS, heroSlides, navItems, pricingCards, testimonials, imageMap, assets };
  }

  createPreviewToken() {
    return this.jwt.sign({ preview: true, scope: "marketing" }, { expiresIn: "30m" });
  }

  verifyPreviewToken(token: string) {
    try {
      const payload = this.jwt.verify(token, { secret: process.env.JWT_SECRET || "dev-secret" }) as {
        preview?: boolean;
      };
      return payload.preview === true;
    } catch {
      return false;
    }
  }

  listPublishedBlogPosts() {
    return this.prisma.marketingBlogPost.findMany({
      where: { status: "published" },
      include: { coverAsset: true },
      orderBy: { publishedAt: "desc" },
    });
  }

  getPublishedBlogPost(slug: string) {
    return this.prisma.marketingBlogPost.findFirst({
      where: { slug, status: "published" },
      include: { coverAsset: true },
    });
  }

  async seedFromCode() {
    const imagesDir = path.resolve(process.cwd(), "../web/public/images");

    await this.updateSite({
      siteName: "Cullinos",
      tagline: "Restaurant Operating System",
      siteDescription:
        "Run your restaurant from one place. Menu, orders, inventory, staff, and analytics — unified for modern restaurant operations.",
      registerUrl: "/contact?intent=trial",
      contactEmail: "hello@rkyves.com",
    });

    await this.upsertThemeDraft(DEFAULT_MARKETING_THEME_TOKENS, "Warm Heritage");
    await this.seedDesignPresets();

    for (const slotKey of MARKETING_IMAGE_SLOTS) {
      const filename = SLOT_TO_FILENAME[slotKey];
      if (!filename || !fs.existsSync(path.join(imagesDir, filename))) continue;

      const existing = await this.prisma.marketingAsset.findFirst({ where: { slotKey } });
      if (existing) continue;

      const copied = this.upload.copyFromPublicImages(imagesDir, slotKey, filename);
      if (!copied) continue;

      await this.prisma.marketingAsset.create({
        data: {
          filename: copied.filename,
          originalName: filename,
          mimeType: copied.mimeType,
          sizeBytes: copied.sizeBytes,
          url: copied.url,
          slotKey,
          alt: slotKey,
        },
      });
    }

    await this.prisma.marketingHeroSlide.deleteMany({ where: { status: "draft" } });
    const slides = [
      {
        headline: "Run your restaurant",
        headlineAccent: "from one place.",
        subline:
          "Cullinos is cloud software that runs your POS, kitchen, waiter app, online orders, and back office — together.",
        imageKey: "heroRestaurant",
        sortOrder: 0,
      },
      {
        headline: "Your kitchen,",
        headlineAccent: "always in sync.",
        subline:
          "Every order from cashier, waiter, or QR menu appears on the kitchen display instantly.",
        imageKey: "heroKitchen",
        sortOrder: 1,
      },
      {
        headline: "One platform,",
        headlineAccent: "every team member.",
        subline:
          "Cashiers, waiters, managers, and owners — each with the right tools and permissions.",
        imageKey: "heroTeam",
        sortOrder: 2,
      },
    ];
    for (const slide of slides) {
      await this.prisma.marketingHeroSlide.create({ data: { ...slide, status: "draft" } });
    }

    await this.prisma.marketingNavItem.deleteMany({ where: { status: "draft" } });
    const nav = [
      { label: "Features", href: "/features", sortOrder: 0 },
      { label: "Pricing", href: "/pricing", sortOrder: 1 },
      { label: "Integrations", href: "/integrations", sortOrder: 2 },
      { label: "About", href: "/about", sortOrder: 3 },
      { label: "Blog", href: "/blog", sortOrder: 4 },
      { label: "Contact", href: "/contact", sortOrder: 5 },
    ];
    for (const item of nav) {
      await this.prisma.marketingNavItem.create({ data: { ...item, groupKey: "main", status: "draft" } });
    }

    await this.prisma.marketingPricingCard.deleteMany({ where: { status: "draft" } });
    const plans = [
      {
        planKey: "STARTER",
        name: "Starter",
        description: "POS, Billing, KOT, Basic reports",
        priceMonthly: 99900,
        priceYearly: 999900,
        maxOutlets: 1,
        maxUsers: 5,
        maxTerminals: 2,
        features: ["POS", "Billing", "KOT", "Basic reports"],
        cta: "register",
        sortOrder: 0,
      },
      {
        planKey: "PROFESSIONAL",
        name: "Professional",
        description: "Full restaurant operations",
        priceMonthly: 299900,
        priceYearly: 2999900,
        maxOutlets: 3,
        maxUsers: 20,
        maxTerminals: 10,
        features: ["Waiter app", "QR ordering", "Inventory", "CRM"],
        cta: "register",
        highlighted: true,
        sortOrder: 1,
      },
      {
        planKey: "ENTERPRISE",
        name: "Enterprise",
        description: "Multi-outlet and franchise",
        priceMonthly: 999900,
        priceYearly: 9999900,
        maxOutlets: 50,
        maxUsers: 200,
        maxTerminals: 100,
        features: ["Multi-outlet", "Franchise", "Advanced analytics"],
        cta: "contact",
        sortOrder: 2,
      },
    ];
    for (const plan of plans) {
      await this.prisma.marketingPricingCard.create({ data: { ...plan, status: "draft" } });
    }

    await this.prisma.marketingTestimonial.deleteMany({ where: { status: "draft" } });
    const reviews = [
      {
        quote:
          "Cullinos replaced three separate systems for our restaurant. POS, kitchen, and online ordering finally talk to each other.",
        author: "Restaurant operator",
        role: "Multi-outlet chain, Mumbai",
        sortOrder: 0,
      },
      {
        quote:
          "GST billing works out of the box. Our accountants love the clean reports and we love not juggling spreadsheets.",
        author: "F&B manager",
        role: "Full-service restaurant, Bangalore",
        sortOrder: 1,
      },
    ];
    for (const review of reviews) {
      await this.prisma.marketingTestimonial.create({ data: { ...review, status: "draft" } });
    }

    await this.upsertPageBlock("home", "reviewsIntro", {
      title: "Trusted by restaurant teams",
      description:
        "Early partners run their daily operations on Cullinos. Join them and simplify how your restaurant works.",
    });

    return { ok: true, message: "Seeded draft marketing content from codebase defaults" };
  }

  private async triggerRevalidate() {
    const url = process.env.MARKETING_REVALIDATE_URL;
    const secret = process.env.REVALIDATE_SECRET;
    if (!url || !secret) return;
    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
        body: JSON.stringify({ paths: ["/", "/features", "/pricing", "/blog"] }),
      });
    } catch {
      // non-blocking
    }
  }
}
