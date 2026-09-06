-- CreateEnum
CREATE TYPE "RestaurantSize" AS ENUM ('small', 'medium', 'large');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN "restaurant_size" "RestaurantSize";
