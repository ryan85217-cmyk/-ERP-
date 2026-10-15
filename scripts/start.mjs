// Production entrypoint (used on Zeabur): migrate → seed demo data if the DB is empty
// or the demo catalog changed → start Next.js. Set SEED_IF_EMPTY=false to never touch data.
import { spawnSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run("npx", ["prisma", "migrate", "deploy"]);

if (process.env.SEED_IF_EMPTY !== "false") {
  // Fingerprint of the catalog the demo data should be built from. When the committed
  // anonymized catalog changes (or appears), the demo database is rebuilt once.
  const catalogPath = process.env.SEED_CATALOG === "builtin" ? null : process.env.SEED_CATALOG || "prisma/data/demo-catalog.json";
  const fingerprint =
    catalogPath && existsSync(catalogPath) ? createHash("sha1").update(readFileSync(catalogPath)).digest("hex") : "builtin";

  const prisma = new PrismaClient();
  const products = await prisma.product.count();
  const marker = await prisma.demoSeedMeta.findUnique({ where: { key: "catalog" } });
  // databases seeded before this marker existed were built from the built-in catalog
  const current = marker?.value ?? (products > 0 ? "builtin" : null);

  if (products === 0 || current !== fingerprint) {
    console.log(products === 0 ? "Database is empty — seeding demo data…" : "Demo catalog changed — rebuilding demo data…");
    run("npx", ["tsx", "prisma/seed.ts"]);
  }
  await prisma.demoSeedMeta.upsert({ where: { key: "catalog" }, create: { key: "catalog", value: fingerprint }, update: { value: fingerprint } });
  await prisma.$disconnect();
}

const port = process.env.PORT ?? "3000";
const next = spawn("npx", ["next", "start", "-H", "0.0.0.0", "-p", port], { stdio: "inherit" });
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => next.kill(sig));
next.on("exit", (code) => process.exit(code ?? 0));
