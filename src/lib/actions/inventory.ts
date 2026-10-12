"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

/** MVP mock of a POS sync: stamps every inventory row with the current sync time. */
export async function syncPosInventory() {
  await prisma.inventory.updateMany({ data: { lastSyncedAt: new Date() } });
  revalidatePath("/inventory", "layout");
  revalidatePath("/");
}

/** Align POS stock to the counted store stock for one product (after investigating a mismatch). */
export async function alignPosToStore(productId: string) {
  const inv = await prisma.inventory.findUnique({ where: { productId } });
  if (!inv) return;
  await prisma.inventory.update({ where: { productId }, data: { posStock: inv.storeStock, lastSyncedAt: new Date() } });
  revalidatePath("/inventory", "layout");
  revalidatePath("/");
}

/** Move units from the logistics center to the store to restore safety stock (×2). */
export async function replenishFromWarehouse(productId: string) {
  const inv = await prisma.inventory.findUnique({ where: { productId } });
  if (!inv) return;
  const need = Math.max(0, inv.safetyStock * 2 - inv.storeStock);
  const qty = Math.min(need, inv.warehouseStock);
  if (qty <= 0) return;
  await prisma.inventory.update({
    where: { productId },
    data: {
      storeStock: inv.storeStock + qty,
      posStock: inv.posStock + qty,
      warehouseStock: inv.warehouseStock - qty,
      lastSyncedAt: new Date(),
    },
  });
  revalidatePath("/inventory", "layout");
  revalidatePath("/");
}
