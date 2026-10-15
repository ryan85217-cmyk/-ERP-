/**
 * Turns a POS "門市即時庫存" report (POS0021 layout) into a seed Catalog.
 *
 * Two outputs:
 * - real        every row as-is (local use only — contains the store's real stock)
 * - anonymized  a category-stratified sample with new SKUs, jittered prices, no
 *               stock figures and no store identity; safe to commit and publish
 */
import type { Catalog, CatalogLocationType } from "../../../prisma/catalog";

export interface PosStockRow {
  group: string; // 大類名稱
  category: string; // 中類名稱
  sku: string; // 品號
  name: string; // 品名
  unit: string;
  price: number; // 單價
  quantity: number; // 數量
  location: string; // 儲位 (e.g. "S1", "Z1A", "S", "")
}

const HEADERS = { group: "大類名稱", category: "中類名稱", sku: "品號", name: "品名", unit: "單位", price: "單價", quantity: "數量", location: "儲位" };

const num = (s: string | undefined) => {
  const n = Number(String(s ?? "").replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/** Finds the header row by its "品號" column and maps the data rows below it. */
export function parsePosStock(values: string[][]): PosStockRow[] {
  const headerIdx = values.findIndex((r) => r.includes(HEADERS.sku) && r.includes(HEADERS.name));
  if (headerIdx < 0) throw new Error("Could not find the POS0021 header row (needs 品號 and 品名 columns)");
  const header = values[headerIdx];
  const col = Object.fromEntries(Object.entries(HEADERS).map(([k, label]) => [k, header.indexOf(label)])) as Record<keyof typeof HEADERS, number>;
  for (const [k, i] of Object.entries(col)) if (i < 0 && k !== "location" && k !== "unit") throw new Error(`Missing column ${HEADERS[k as keyof typeof HEADERS]}`);
  return values
    .slice(headerIdx + 1)
    .filter((r) => /^\d+$/.test((r[col.sku] ?? "").trim()))
    .map((r) => ({
      group: (r[col.group] ?? "").trim() || "其他",
      category: (r[col.category] ?? "").trim() || "其他",
      sku: r[col.sku].trim(),
      name: (r[col.name] ?? "").trim(),
      unit: col.unit >= 0 ? (r[col.unit] ?? "").trim() : "",
      price: num(r[col.price]),
      quantity: num(r[col.quantity]),
      location: col.location >= 0 ? (r[col.location] ?? "").trim().toUpperCase() : "",
    }));
}

/** POS shelf codes ("S1", "Z1A", "S") → ERP zone-aisle-level codes ("S-01-01", "Z-01-01", "S-00-01"). */
export function mapLocation(raw: string) {
  const m = raw.match(/^([A-Z]+)(\d*)([A-Z]?)$/);
  if (!m) return null;
  const zone = m[1];
  const aisle = m[2] ? Number(m[2]) : 0;
  const level = m[3] ? m[3].charCodeAt(0) - 64 : 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  return { code: `${zone}-${pad(aisle)}-${pad(level)}`, zone, aisle, level };
}

// translations for the POS mid-level categories, so the ja / en UI isn't all Chinese
const CATEGORY_I18N: Record<string, { en: string; ja: string }> = {
  安心蔬果: { en: "Fresh Produce", ja: "青果" },
  "米麵/調理食材": { en: "Rice, Noodles & Cooking", ja: "米・麺・調理食材" },
  "即食料理/糕點": { en: "Ready Meals & Bakery", ja: "惣菜・菓子" },
  "飲品/零食": { en: "Drinks & Snacks", ja: "飲料・スナック" },
  養身保健: { en: "Health & Wellness", ja: "健康食品" },
  居家日用: { en: "Household", ja: "日用品" },
  個人清潔保養: { en: "Personal Care", ja: "パーソナルケア" },
  衣飾鞋包: { en: "Apparel & Accessories", ja: "衣料・服飾雑貨" },
  "圖書/宗教文物": { en: "Books & Religious Items", ja: "書籍・宗教用品" },
  寵物食品: { en: "Pet Food", ja: "ペットフード" },
  寵物用品: { en: "Pet Supplies", ja: "ペット用品" },
  其他: { en: "Other", ja: "その他" },
};

const GROUP_ORDER = ["農產品", "食品", "一般百貨", "有機棉/服飾", "影音圖書", "寵物系列", "其他"];
const GROUP_SKU_PREFIX: Record<string, string> = { 農產品: "AGR", 食品: "FOD", 一般百貨: "HOM", "有機棉/服飾": "APP", 影音圖書: "BOK", 寵物系列: "PET", 其他: "OTH" };
/** food sells more often than apparel or books */
const GROUP_POPULARITY: Record<string, [number, number]> = { 農產品: [5, 10], 食品: [3, 9], 一般百貨: [2, 6], "有機棉/服飾": [1, 4], 影音圖書: [1, 3], 寵物系列: [1, 4], 其他: [1, 3] };

function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildMaster(rows: PosStockRow[], keepLocationNotes: boolean) {
  const groupRank = (g: string) => (GROUP_ORDER.indexOf(g) + 1 || GROUP_ORDER.length + 1);
  const categories = Array.from(new Map(rows.map((r) => [r.category, r.group])).entries())
    .sort((a, b) => groupRank(a[1]) - groupRank(b[1]))
    .map(([name]) => ({ name, nameEn: CATEGORY_I18N[name]?.en ?? null, nameJa: CATEGORY_I18N[name]?.ja ?? null }));

  // a zone is chilled when produce dominates it, otherwise regular shelving
  const zoneGroups = new Map<string, Map<string, number>>();
  const locations = new Map<string, Catalog["locations"][number]>();
  for (const r of rows) {
    const loc = mapLocation(r.location);
    if (!loc) continue;
    const g = zoneGroups.get(loc.zone) ?? new Map<string, number>();
    g.set(r.group, (g.get(r.group) ?? 0) + 1);
    zoneGroups.set(loc.zone, g);
    if (!locations.has(loc.code)) locations.set(loc.code, { ...loc, type: "SHELF", note: keepLocationNotes ? `POS 儲位 ${r.location}` : null });
  }
  for (const l of locations.values()) {
    const top = [...(zoneGroups.get(l.zone) ?? new Map()).entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    l.type = (top === "農產品" ? "CHILLED" : "SHELF") satisfies CatalogLocationType;
  }
  return { categories, locations: [...locations.values()].sort((a, b) => a.code.localeCompare(b.code)) };
}

/** Every row, real SKUs, prices and quantities. Keep this off public hosts and out of git. */
export function toRealCatalog(rows: PosStockRow[], source: string): Catalog {
  const rand = rng(20261014);
  const { categories, locations } = buildMaster(rows, true);
  return {
    source,
    categories,
    locations,
    products: rows.map((r) => {
      const [lo, hi] = GROUP_POPULARITY[r.group] ?? [1, 5];
      return {
        sku: r.sku,
        name: r.name,
        category: r.category,
        price: Math.max(0, Math.round(r.price)),
        unit: r.unit || null,
        locationCode: mapLocation(r.location)?.code ?? null,
        stock: Math.max(0, Math.round(r.quantity)),
        popularity: lo + Math.floor(rand() * (hi - lo + 1)),
      };
    }),
  };
}

/**
 * Category-stratified sample with no store identity: new SKUs, prices jittered ±12 %
 * (missing prices invented), no stock figures, store-brand names stripped.
 */
export function toAnonymizedCatalog(rows: PosStockRow[], target = 240): Catalog {
  const rand = rng(20261015);
  const shuffle = <T,>(a: T[]) => {
    const b = [...a];
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  };
  const ratio = Math.min(1, target / rows.length);
  const byCategory = new Map<string, PosStockRow[]>();
  for (const r of rows) byCategory.set(r.category, [...(byCategory.get(r.category) ?? []), r]);
  const sample: PosStockRow[] = [];
  for (const list of byCategory.values()) sample.push(...shuffle(list).slice(0, Math.min(list.length, Math.max(3, Math.round(list.length * ratio)))));

  const { categories, locations } = buildMaster(sample, false);
  const counters = new Map<string, number>();
  const products = sample
    .sort((a, b) => a.category.localeCompare(b.category) || a.sku.localeCompare(b.sku))
    .map((r) => {
      const prefix = GROUP_SKU_PREFIX[r.group] ?? "OTH";
      const n = (counters.get(prefix) ?? 0) + 1;
      counters.set(prefix, n);
      const base = r.price > 0 ? r.price * (0.88 + rand() * 0.24) : 59 + rand() * 340;
      const [lo, hi] = GROUP_POPULARITY[r.group] ?? [1, 5];
      return {
        sku: `${prefix}-${String(n).padStart(4, "0")}`,
        name: r.name.replace(/里仁/g, "").replace(/^[\s\-_·、]+|[\s\-_·、]+$/g, "").trim() || r.category,
        category: r.category,
        price: Math.max(10, Math.round(base / 5) * 5),
        unit: r.unit || null,
        locationCode: mapLocation(r.location)?.code ?? null,
        stock: null,
        popularity: lo + Math.floor(rand() * (hi - lo + 1)),
      };
    });
  return { source: "POS stock report, anonymized sample", categories, locations, products };
}
