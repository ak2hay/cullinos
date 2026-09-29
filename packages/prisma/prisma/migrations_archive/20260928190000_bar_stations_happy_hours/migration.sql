-- Category → kitchen station routing (e.g. BAR tickets)
ALTER TABLE "menu_categories" ADD COLUMN "kitchen_station_code" TEXT;

-- Happy hour pricing rules
CREATE TABLE "happy_hour_rules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "outlet_id" TEXT,
    "name" TEXT NOT NULL,
    "days_of_week" INTEGER[],
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "discount_type" TEXT NOT NULL DEFAULT 'percent',
    "discount_value" DECIMAL(12,2) NOT NULL,
    "category_ids" TEXT[],
    "menu_item_ids" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "happy_hour_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "happy_hour_rules_organization_id_is_active_idx" ON "happy_hour_rules"("organization_id", "is_active");

ALTER TABLE "happy_hour_rules" ADD CONSTRAINT "happy_hour_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "happy_hour_rules" ADD CONSTRAINT "happy_hour_rules_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
