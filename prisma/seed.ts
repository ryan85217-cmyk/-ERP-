import { existsSync, readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { generateSeedData } from "./seed-data";
import { DEMO_CATALOG_PATH, type Catalog } from "./catalog";

const prisma = new PrismaClient();

async function chunked<T>(rows: T[], size: number, fn: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += size) {
    await fn(rows.slice(i, i + size));
  }
}

/**
 * Which product catalog to seed with:
 * - SEED_CATALOG=<path>  a catalog JSON (e.g. a local, real POS import)
 * - SEED_CATALOG=builtin the original 52 hand-written demo products
 * - unset                the committed anonymized catalog if present, else builtin
 */
function loadCatalog(): Catalog | undefined {
  const choice = process.env.SEED_CATALOG;
  if (choice === "builtin") return undefined;
  const path = choice || DEMO_CATALOG_PATH;
  if (!existsSync(path)) {
    if (choice) throw new Error(`SEED_CATALOG file not found: ${path}`);
    return undefined;
  }
  return JSON.parse(readFileSync(path, "utf8")) as Catalog;
}

/** Seeds the database; exported so the Sheets import script can reuse it. */
export async function seed(catalog: Catalog | undefined) {
  const now = new Date();
  console.log(`Generating demo data (${catalog ? `${catalog.source}, ${catalog.products.length} products` : "built-in catalog"})…`);
  const data = generateSeedData(now, catalog);

  console.log("Clearing existing data…");
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.inventoryCountItem.deleteMany();
  await prisma.inventoryCountSession.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.storageLocation.deleteMany();
  await prisma.category.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.member.deleteMany();

  console.log("Seeding master data…");
  await prisma.category.createMany({ data: data.categories });
  await prisma.storageLocation.createMany({ data: data.locations });
  await prisma.supplier.createMany({ data: data.suppliers.map((s) => ({ ...s })) });
  await prisma.product.createMany({ data: data.products });
  await prisma.inventory.createMany({ data: data.inventories });

  console.log(`Seeding ${data.members.length} members…`);
  await chunked(data.members, 1000, (chunk) => prisma.member.createMany({ data: chunk }));

  console.log(`Seeding ${data.orders.length} orders / ${data.orderItems.length} order items…`);
  await chunked(data.orders, 5000, (chunk) => prisma.order.createMany({ data: chunk }));
  await chunked(data.orderItems, 10000, (chunk) => prisma.orderItem.createMany({ data: chunk }));

  console.log("Seeding inventory count sessions…");
  await prisma.inventoryCountSession.createMany({ data: data.sessions });

  await chunked(data.countItems, 10000, (chunk) => prisma.inventoryCountItem.createMany({ data: chunk }));
  console.log("✅ Seed complete");
}

// run directly: `tsx prisma/seed.ts`
if (process.argv[1]?.replace(/\\/g, "/").endsWith("prisma/seed.ts")) {
  seed(loadCatalog())
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export async function disconnectSeed() {
  await prisma.$disconnect();
}
