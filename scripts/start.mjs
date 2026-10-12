// Production entrypoint (used on Zeabur): migrate → seed demo data if the DB is empty → start Next.js.
import { spawnSync, spawn } from "node:child_process";
import { PrismaClient } from "@prisma/client";

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run("npx", ["prisma", "migrate", "deploy"]);

if (process.env.SEED_IF_EMPTY !== "false") {
  const prisma = new PrismaClient();
  const products = await prisma.product.count();
  await prisma.$disconnect();
  if (products === 0) {
    console.log("Database is empty — seeding demo data…");
    run("npx", ["tsx", "prisma/seed.ts"]);
  }
}

const port = process.env.PORT ?? "3000";
const next = spawn("npx", ["next", "start", "-H", "0.0.0.0", "-p", port], { stdio: "inherit" });
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => next.kill(sig));
next.on("exit", (code) => process.exit(code ?? 0));
