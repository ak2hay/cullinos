-- CreateTable
CREATE TABLE "inventory_lots" (
    "id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "qty_remaining" DECIMAL(12,3) NOT NULL,
    "unit_cost" DECIMAL(12,2) NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL,
    "expiry_date" TIMESTAMP(3),
    "grn_item_id" TEXT,

    CONSTRAINT "inventory_lots_pkey" PRIMARY KEY ("id")
);

-- AlterTable: stock movements lot link
ALTER TABLE "stock_movements" ADD COLUMN "lot_id" TEXT;

-- AlterTable: recipe hierarchy
ALTER TABLE "recipes" ADD COLUMN "parent_recipe_id" TEXT;

-- AlterTable: recipe ingredients support inventory OR sub-recipe
ALTER TABLE "recipe_ingredients" ALTER COLUMN "inventory_item_id" DROP NOT NULL;
ALTER TABLE "recipe_ingredients" ADD COLUMN "sub_recipe_id" TEXT;

-- AlterTable: central kitchen route planning
ALTER TABLE "central_kitchen_indents" ADD COLUMN "route_code" TEXT;
ALTER TABLE "central_kitchen_indents" ADD COLUMN "sequence" INTEGER;

-- CreateIndex
CREATE INDEX "inventory_lots_inventory_item_id_received_at_idx" ON "inventory_lots"("inventory_item_id", "received_at");

-- AddForeignKey
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_grn_item_id_fkey" FOREIGN KEY ("grn_item_id") REFERENCES "grn_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "inventory_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recipes" ADD CONSTRAINT "recipes_parent_recipe_id_fkey" FOREIGN KEY ("parent_recipe_id") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_sub_recipe_id_fkey" FOREIGN KEY ("sub_recipe_id") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
