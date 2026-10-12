import { HIGH_STOCK_FACTOR } from "@/lib/constants";

export interface StockLike {
  posStock: number;
  storeStock: number;
  warehouseStock: number;
  safetyStock: number;
}

export type StockFlag = "low" | "mismatch" | "high";

export function stockFlags(s: StockLike): StockFlag[] {
  const flags: StockFlag[] = [];
  if (s.storeStock < s.safetyStock) flags.push("low");
  if (s.posStock !== s.storeStock) flags.push("mismatch");
  if (s.safetyStock > 0 && s.storeStock > s.safetyStock * HIGH_STOCK_FACTOR) flags.push("high");
  return flags;
}

export const FLAG_VARIANT: Record<StockFlag, "destructive" | "warning" | "info"> = {
  low: "destructive",
  mismatch: "warning",
  high: "info",
};
