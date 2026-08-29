-- Food business verticals expansion

CREATE TYPE "BusinessType" AS ENUM ('restaurant', 'cafe', 'food_truck', 'bakery', 'qsr', 'cloud_kitchen', 'catering');
CREATE TYPE "OperatingMode" AS ENUM ('full_service', 'counter', 'hybrid');
CREATE TYPE "PriceType" AS ENUM ('retail', 'wholesale');
CREATE TYPE "ProductionBatchStatus" AS ENUM ('planned', 'in_progress', 'completed', 'cancelled');

ALTER TABLE "organizations" ADD COLUMN "business_type" "BusinessType" NOT NULL DEFAULT 'restaurant';

ALTER TABLE "outlets" ADD COLUMN "operating_mode" "OperatingMode" NOT NULL DEFAULT 'full_service';

ALTER TABLE "menu_items" ADD COLUMN "allergens" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "menu_schedules" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "menu_schedules" ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "menu_schedules" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "outlet_menu_prices" ADD COLUMN "price_type" "PriceType" NOT NULL DEFAULT 'retail';
ALTER TABLE "outlet_menu_prices" DROP CONSTRAINT IF EXISTS "outlet_menu_prices_outlet_id_menu_item_id_key";
ALTER TABLE "outlet_menu_prices" ADD CONSTRAINT "outlet_menu_prices_outlet_id_menu_item_id_price_type_key" UNIQUE ("outlet_id", "menu_item_id", "price_type");

ALTER TABLE "orders" ADD COLUMN "tip_amount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "customer_name" TEXT;
ALTER TABLE "orders" ADD COLUMN "scheduled_pickup_at" TIMESTAMP(3);

ALTER TABLE "inventory_items" ADD COLUMN "batch_number" TEXT;
ALTER TABLE "inventory_items" ADD COLUMN "expiry_date" TIMESTAMP(3);

ALTER TABLE "customers" ADD COLUMN "stamp_count" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "menu_schedules"
  ADD CONSTRAINT "menu_schedules_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "outlet_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "address" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "event_date" TIMESTAMP(3) NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "pre_order_opens_at" TIMESTAMP(3),
    "pre_order_closes_at" TIMESTAMP(3),
    "max_pre_orders" INTEGER,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outlet_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "production_batches" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "recipe_id" TEXT,
    "name" TEXT NOT NULL,
    "planned_qty" DECIMAL(12,2) NOT NULL,
    "actual_qty" DECIMAL(12,2),
    "scale_factor" DECIMAL(8,2) NOT NULL DEFAULT 1,
    "status" "ProductionBatchStatus" NOT NULL DEFAULT 'planned',
    "batch_number" TEXT,
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_batches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "outlet_events_outlet_id_event_date_idx" ON "outlet_events"("outlet_id", "event_date");
CREATE INDEX "production_batches_outlet_id_scheduled_for_idx" ON "production_batches"("outlet_id", "scheduled_for");

ALTER TABLE "outlet_events" ADD CONSTRAINT "outlet_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outlet_events" ADD CONSTRAINT "outlet_events_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
