/**
 * Import the POS stock report (POS0021 layout) from Google Sheets.
 *
 *   npm run sheets:import -- real        reseed the LOCAL database with the real report
 *   npm run sheets:import -- anonymize   write prisma/data/demo-catalog.json (safe to commit)
 *
 * Needs GOOGLE_SERVICE_ACCOUNT_FILE (or _JSON) and POS_STOCK_SHEET (id or URL) in .env.
 * Optional: POS_STOCK_RANGE (default "A1:L"), DEMO_CATALOG_SIZE (default 240).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { readRange } from "../src/lib/google/sheets";
import { parsePosStock, toAnonymizedCatalog, toRealCatalog } from "../src/lib/pos-import/pos-stock";
import { DEMO_CATALOG_PATH } from "../prisma/catalog";

const REAL_CATALOG_PATH = ".local-data/pos-catalog.json";

try {
  process.loadEnvFile(".env");
} catch {
  // no .env: rely on the real environment
}

function assertLocalDatabase() {
  const url = process.env.DATABASE_URL ?? "";
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    // fall through to the error below
  }
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
    throw new Error(
      `Refusing to load real store data into a non-local database (${host || "DATABASE_URL not set"}). ` +
        "Real POS data stays on this computer; use `anonymize` for anything hosted.",
    );
  }
}

async function main() {
  const mode = process.argv[2];
  if (mode !== "real" && mode !== "anonymize") {
    console.error("Usage: npm run sheets:import -- <real|anonymize>");
    process.exit(1);
  }
  const sheet = process.env.POS_STOCK_SHEET;
  if (!sheet) throw new Error("Set POS_STOCK_SHEET (spreadsheet id or URL) in .env");
  if (mode === "real") assertLocalDatabase();

  console.log("Reading POS stock report from Google Sheets…");
  const rows = parsePosStock(await readRange(sheet, process.env.POS_STOCK_RANGE ?? "A1:L"));
  console.log(`Parsed ${rows.length} products`);

  if (mode === "anonymize") {
    const catalog = toAnonymizedCatalog(rows, Number(process.env.DEMO_CATALOG_SIZE ?? 240));
    mkdirSync(dirname(DEMO_CATALOG_PATH), { recursive: true });
    writeFileSync(DEMO_CATALOG_PATH, JSON.stringify(catalog, null, 1) + "\n");
    console.log(
      `Wrote ${DEMO_CATALOG_PATH}: ${catalog.products.length} products, ${catalog.categories.length} categories, ${catalog.locations.length} locations`,
    );
    return;
  }

  const catalog = toRealCatalog(rows, "POS stock report (real, local)");
  mkdirSync(dirname(REAL_CATALOG_PATH), { recursive: true });
  writeFileSync(REAL_CATALOG_PATH, JSON.stringify(catalog) + "\n");
  console.log(`Saved ${REAL_CATALOG_PATH} (git-ignored); reseeding the local database…`);
  const { seed, disconnectSeed } = await import("../prisma/seed");
  try {
    await seed(catalog);
  } finally {
    await disconnectSeed();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
