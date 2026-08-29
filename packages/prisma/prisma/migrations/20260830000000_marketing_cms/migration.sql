-- CreateEnum
CREATE TYPE "MarketingContentStatus" AS ENUM ('draft', 'published');

-- CreateTable
CREATE TABLE "marketing_sites" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "site_name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "site_description" TEXT,
    "register_url" TEXT,
    "admin_url" TEXT,
    "contact_email" TEXT,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "last_published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_themes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default',
    "status" "MarketingContentStatus" NOT NULL DEFAULT 'draft',
    "tokens" JSONB NOT NULL,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_themes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_assets" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "slot_key" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "uploaded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_hero_slides" (
    "id" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "headline_accent" TEXT NOT NULL,
    "subline" TEXT NOT NULL,
    "image_asset_id" TEXT,
    "image_key" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "MarketingContentStatus" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_hero_slides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_pages" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "status" "MarketingContentStatus" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_blocks" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "block_key" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "MarketingContentStatus" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_nav_items" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "group_key" TEXT NOT NULL DEFAULT 'main',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "MarketingContentStatus" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_nav_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_pricing_cards" (
    "id" TEXT NOT NULL,
    "plan_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price_monthly" INTEGER NOT NULL,
    "price_yearly" INTEGER NOT NULL,
    "max_outlets" INTEGER NOT NULL DEFAULT 1,
    "max_users" INTEGER NOT NULL DEFAULT 5,
    "max_terminals" INTEGER NOT NULL DEFAULT 2,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cta" TEXT NOT NULL DEFAULT 'register',
    "highlighted" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "MarketingContentStatus" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_pricing_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_testimonials" (
    "id" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "MarketingContentStatus" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_testimonials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_blog_posts" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "body" TEXT NOT NULL,
    "cover_asset_id" TEXT,
    "status" "MarketingContentStatus" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_design_presets" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "theme_tokens" JSONB NOT NULL,
    "layout_hints" JSONB NOT NULL,
    "copy_tone" TEXT NOT NULL,
    "image_prompts" JSONB NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_design_presets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "marketing_pages_slug_key" ON "marketing_pages"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "marketing_blocks_page_id_block_key_status_key" ON "marketing_blocks"("page_id", "block_key", "status");

-- CreateIndex
CREATE UNIQUE INDEX "marketing_blog_posts_slug_key" ON "marketing_blog_posts"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "marketing_design_presets_slug_key" ON "marketing_design_presets"("slug");

-- CreateIndex
CREATE INDEX "marketing_assets_slot_key_idx" ON "marketing_assets"("slot_key");

-- AddForeignKey
ALTER TABLE "marketing_hero_slides" ADD CONSTRAINT "marketing_hero_slides_image_asset_id_fkey" FOREIGN KEY ("image_asset_id") REFERENCES "marketing_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_blocks" ADD CONSTRAINT "marketing_blocks_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "marketing_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_blog_posts" ADD CONSTRAINT "marketing_blog_posts_cover_asset_id_fkey" FOREIGN KEY ("cover_asset_id") REFERENCES "marketing_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
