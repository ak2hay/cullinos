-- Aggregator settlements + unique integration per org/provider

CREATE TABLE "aggregator_settlements" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "outlet_id" TEXT,
    "provider" TEXT NOT NULL,
    "external_order_id" TEXT NOT NULL,
    "order_id" TEXT,
    "order_date" TIMESTAMP(3) NOT NULL,
    "gross_amount" DECIMAL(12,2) NOT NULL,
    "commission" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax_on_commission" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "payout" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'imported',
    "raw_payload" JSONB,
    "batch_id" TEXT,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aggregator_settlements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "aggregator_settlements_organization_id_provider_external_order_id_key"
ON "aggregator_settlements"("organization_id", "provider", "external_order_id");

CREATE INDEX "aggregator_settlements_organization_id_order_date_idx"
ON "aggregator_settlements"("organization_id", "order_date");

ALTER TABLE "aggregator_settlements" ADD CONSTRAINT "aggregator_settlements_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "aggregator_settlements" ADD CONSTRAINT "aggregator_settlements_outlet_id_fkey"
FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "aggregator_settlements" ADD CONSTRAINT "aggregator_settlements_order_id_fkey"
FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "integrations_organization_id_provider_key"
ON "integrations"("organization_id", "provider");
