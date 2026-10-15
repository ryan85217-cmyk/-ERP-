import { prisma } from "@/lib/prisma";
import type { PosCatalogItem } from "./generator";

/** Stable pseudo-popularity from the SKU, so the simulated POS favours the same items every day. */
function skuWeight(sku: string, price: number) {
  let h = 0;
  for (const ch of sku) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const base = 1 + (h % 9);
  return price > 0 && price < 150 ? base * 1.5 : base; // cheap staples sell more often
}

/** The POS and ERP share one SKU master (as real stores do): read it from the ERP database. */
export async function posCatalog(): Promise<{ catalog: PosCatalogItem[]; memberCards: string[] }> {
  const [products, members] = await Promise.all([
    prisma.product.findMany({ where: { isActive: true, price: { gt: 0 } }, select: { sku: true, name: true, price: true }, orderBy: { sku: "asc" } }),
    prisma.member.findMany({ select: { memberNumber: true }, orderBy: { memberNumber: "asc" } }),
  ]);
  return {
    catalog: products.map((p) => ({ sku: p.sku, name: p.name, price: p.price, weight: skuWeight(p.sku, p.price) })),
    memberCards: members.map((m) => m.memberNumber),
  };
}
