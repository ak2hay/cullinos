-- AlterTable
ALTER TABLE "menu_items" ADD COLUMN     "kitchen_station_code" TEXT,
ADD COLUMN     "is_tax_exempt" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "kitchen_stations" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatar_url" TEXT;
