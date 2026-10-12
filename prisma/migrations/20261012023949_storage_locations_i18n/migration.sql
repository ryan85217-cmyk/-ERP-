-- CreateEnum
CREATE TYPE "public"."LocationType" AS ENUM ('SHELF', 'DISPLAY', 'CHILLED', 'FROZEN', 'BACKROOM');

-- AlterTable
ALTER TABLE "public"."Category" ADD COLUMN     "nameEn" TEXT,
ADD COLUMN     "nameJa" TEXT;

-- AlterTable
ALTER TABLE "public"."InventoryCountItem" ADD COLUMN     "locationCode" TEXT,
ADD COLUMN     "locationId" TEXT;

-- AlterTable
ALTER TABLE "public"."InventoryCountSession" ADD COLUMN     "zones" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "public"."Product" ADD COLUMN     "locationId" TEXT,
ADD COLUMN     "nameEn" TEXT,
ADD COLUMN     "nameJa" TEXT;

-- CreateTable
CREATE TABLE "public"."StorageLocation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "aisle" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "type" "public"."LocationType" NOT NULL DEFAULT 'SHELF',
    "capacity" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StorageLocation_code_key" ON "public"."StorageLocation"("code");

-- CreateIndex
CREATE INDEX "StorageLocation_zone_idx" ON "public"."StorageLocation"("zone");

-- CreateIndex
CREATE INDEX "InventoryCountItem_locationId_idx" ON "public"."InventoryCountItem"("locationId");

-- CreateIndex
CREATE INDEX "Product_locationId_idx" ON "public"."Product"("locationId");

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."StorageLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InventoryCountItem" ADD CONSTRAINT "InventoryCountItem_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."StorageLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
