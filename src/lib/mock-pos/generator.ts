/**
 * Simulated POS: produces realistic till transactions for any time window.
 *
 * Deterministic — each minute is seeded by its own timestamp, so asking for the same
 * window twice returns identical transactions (like a real POS's history). Traffic
 * follows store hours (09:00–22:00 Asia/Taipei), lunch/evening peaks and busier weekends.
 */

export interface PosCatalogItem {
  sku: string;
  name: string;
  price: number;
  /** relative sales weight */
  weight: number;
}

export interface PosTransaction {
  txn_id: string;
  store_id: string;
  sold_at: string;
  member_card: string | null;
  payment: "CASH" | "CARD" | "LINE_PAY" | "EASY_CARD";
  lines: { sku: string; name: string; qty: number; unit_price: number; amount: number }[];
  total: number;
}

export const MOCK_STORE_ID = "S001";
const MINUTE = 60_000;
const TZ = 8 * 3_600_000;
/** transactions per hour of day (local), same shape as the seeded history */
const HOUR_WEIGHTS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 5, 7, 10, 8, 5, 5, 6, 9, 11, 9, 6, 3, 0, 0];
const HOUR_TOTAL = HOUR_WEIGHTS.reduce((a, b) => a + b, 0);
const ORDERS_PER_DAY = 34;
const PAYMENTS: PosTransaction["payment"][] = ["CASH", "CARD", "LINE_PAY", "EASY_CARD"];
const PAYMENT_WEIGHTS = [35, 30, 25, 10];

function rng(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weighted<T>(items: readonly T[], weights: readonly number[], r: number) {
  const total = weights.reduce((a, b) => a + b, 0);
  let x = r * total;
  for (let i = 0; i < items.length; i++) {
    x -= weights[i];
    if (x <= 0) return items[i];
  }
  return items[items.length - 1];
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/**
 * Transactions with since <= sold_at < until (both clamped to `now`; at most 24 h per call).
 * `catalog` should be sorted (e.g. by SKU) so the same window maps to the same products.
 */
export function generateTransactions(
  since: Date,
  until: Date,
  catalog: PosCatalogItem[],
  memberCards: string[],
  now = new Date(),
): PosTransaction[] {
  if (!catalog.length) return [];
  const end = Math.min(until.getTime(), now.getTime(), since.getTime() + 24 * 3_600_000);
  const weights = catalog.map((c) => c.weight);
  const out: PosTransaction[] = [];

  for (let m = Math.ceil(since.getTime() / MINUTE) * MINUTE; m < end; m += MINUTE) {
    const local = new Date(m + TZ);
    const hour = local.getUTCHours();
    if (!HOUR_WEIGHTS[hour]) continue;
    const dow = local.getUTCDay();
    const dayFactor = dow === 0 || dow === 6 ? 1.35 : dow === 5 ? 1.15 : 1;
    const perMinute = ((ORDERS_PER_DAY * dayFactor * HOUR_WEIGHTS[hour]) / HOUR_TOTAL) / 60;

    const rand = rng(Math.floor(m / MINUTE));
    const count = rand() < perMinute ? (rand() < 0.08 ? 2 : 1) : 0;
    for (let k = 0; k < count; k++) {
      const soldAt = new Date(m + Math.floor(rand() * 59_000));
      if (soldAt.getTime() >= end) continue;
      const lineCount = 1 + Math.floor(rand() * 4) + (rand() < 0.15 ? 2 : 0);
      const lines = new Map<string, PosTransaction["lines"][number]>();
      for (let l = 0; l < lineCount; l++) {
        const item = weighted(catalog, weights, rand());
        const qty = rand() < 0.75 ? 1 : 2 + Math.floor(rand() * 2);
        const prev = lines.get(item.sku);
        const q = (prev?.qty ?? 0) + qty;
        lines.set(item.sku, { sku: item.sku, name: item.name, qty: q, unit_price: item.price, amount: q * item.price });
      }
      const member = memberCards.length && rand() < 0.6 ? memberCards[Math.floor(rand() * memberCards.length)] : null;
      const items = [...lines.values()];
      out.push({
        txn_id: `${MOCK_STORE_ID}-${local.getUTCFullYear()}${pad(local.getUTCMonth() + 1)}${pad(local.getUTCDate())}-${pad(hour)}${pad(local.getUTCMinutes())}-${k + 1}`,
        store_id: MOCK_STORE_ID,
        sold_at: soldAt.toISOString(),
        member_card: member,
        payment: weighted(PAYMENTS, PAYMENT_WEIGHTS, rand()),
        lines: items,
        total: items.reduce((a, l) => a + l.amount, 0),
      });
    }
  }
  return out;
}
