import type { LocationType } from "@prisma/client";

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Canonical location code: {zone}-{aisle:02}-{level:02}, e.g. "B-02-03". */
export function locationCode(zone: string, aisle: number, level: number) {
  return `${zone.toUpperCase()}-${pad2(aisle)}-${pad2(level)}`;
}

export type UsageBand = "empty" | "low" | "mid" | "high" | "over" | "inactive" | "unknown";

export function usageBand(qty: number, capacity: number | null, isActive = true): UsageBand {
  if (!isActive) return "inactive";
  if (qty === 0) return "empty";
  if (!capacity) return "unknown";
  const r = qty / capacity;
  if (r > 1) return "over";
  if (r >= 0.9) return "high";
  if (r >= 0.5) return "mid";
  return "low";
}

export const USAGE_BAND_CLASS: Record<UsageBand, string> = {
  empty: "bg-muted text-muted-foreground border-dashed",
  low: "bg-success/15 text-success border-success/30",
  mid: "bg-info/15 text-info border-info/30",
  high: "bg-warning/25 text-[oklch(0.45_0.12_70)] border-warning/50",
  over: "bg-destructive/15 text-destructive border-destructive/40",
  inactive: "bg-muted/40 text-muted-foreground/60 border-dashed line-through",
  unknown: "bg-secondary text-secondary-foreground",
};

export const USAGE_BAR_CLASS: Partial<Record<UsageBand, string>> = {
  high: "bg-warning",
  over: "bg-destructive",
};

export interface LocationStats {
  productCount: number;
  stock: number;
  usage: number | null;
  band: UsageBand;
}

export function locationStats(
  loc: { capacity: number | null; isActive: boolean; type?: LocationType },
  products: { inventory: { storeStock: number } | null }[],
): LocationStats {
  const stock = products.reduce((a, p) => a + (p.inventory?.storeStock ?? 0), 0);
  return {
    productCount: products.length,
    stock,
    usage: loc.capacity ? stock / loc.capacity : null,
    band: usageBand(stock, loc.capacity, loc.isActive),
  };
}
