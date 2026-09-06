-- AlterTable
ALTER TABLE "orders" ADD COLUMN "pickup_code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "orders_outlet_id_pickup_code_key" ON "orders"("outlet_id", "pickup_code");
