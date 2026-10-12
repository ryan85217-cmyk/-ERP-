import { PrismaClient } from "@prisma/client";
import { generateSeedData } from "./seed-data";

const prisma = new PrismaClient();

async function chunked<T>(rows: T[], size: number, fn: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += size) {
    await fn(rows.slice(i, i + size));
  }
}

async function main() {
  const now = new Date();
  console.log("Generating demo data…");
  const data = generateSeedData(now);

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
  await prisma.inventoryCountItem.createMany({ data: data.countItems });

  console.log("✅ Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
