/**
 * External product catalog that the seed generator can use instead of the built-in
 * demo products. Produced by `scripts/sheets-import.ts` from a POS stock report
 * (real, local only) or its anonymized sample (committed as prisma/data/demo-catalog.json).
 */
export type CatalogLocationType = "SHELF" | "DISPLAY" | "CHILLED" | "FROZEN" | "BACKROOM";

export interface Catalog {
  /** human-readable provenance, e.g. "POS0021 anonymized sample" */
  source: string;
  categories: { name: string; nameEn?: string | null; nameJa?: string | null }[];
  locations: { code: string; zone: string; aisle: number; level: number; type: CatalogLocationType; note?: string | null }[];
  products: {
    sku: string;
    name: string;
    /** must match a category name */
    category: string;
    price: number;
    /** stock unit, e.g. 瓶 / 包 / 公克; null = pieces */
    unit?: string | null;
    /** must match a location code; null = no location */
    locationCode: string | null;
    /** on-hand quantity; null lets the generator invent one */
    stock: number | null;
    /** relative sales weight 1–10 */
    popularity: number;
  }[];
}

/** Path of the committed, anonymized catalog used by default when seeding. */
export const DEMO_CATALOG_PATH = "prisma/data/demo-catalog.json";
