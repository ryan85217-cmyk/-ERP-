// Local PostgreSQL for development without Docker / system install.
// Usage: npm run db:start   (keeps running; Ctrl+C to stop)
import EmbeddedPostgres from "embedded-postgres";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const databaseDir = resolve(process.cwd(), ".pgdata");
const firstRun = !existsSync(resolve(databaseDir, "PG_VERSION"));

// Already running? Say so plainly instead of PostgreSQL's "lock file already exists" crash.
const pidFile = resolve(databaseDir, "postmaster.pid");
if (existsSync(pidFile)) {
  const pid = Number(readFileSync(pidFile, "utf8").split("\n")[0]);
  let alive = false;
  try {
    process.kill(pid, 0);
    alive = true;
  } catch {
    // stale lock from a crash; PostgreSQL removes it on start
  }
  if (alive) {
    console.log(`資料庫已經在執行中（PID ${pid}），不需要再啟動。 Database is already running (PID ${pid}).`);
    process.exit(0);
  }
}

const pg = new EmbeddedPostgres({
  databaseDir,
  user: "postgres",
  password: "postgres",
  port: Number(process.env.PGPORT ?? 5432),
  persistent: true,
});

if (firstRun) await pg.initialise();
await pg.start();
if (firstRun) await pg.createDatabase("retail_erp");
console.log(`PostgreSQL ready on port ${process.env.PGPORT ?? 5432} (data: .pgdata)`);

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
