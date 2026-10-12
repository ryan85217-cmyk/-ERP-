// Local PostgreSQL for development without Docker / system install.
// Usage: npm run db:start   (keeps running; Ctrl+C to stop)
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const databaseDir = resolve(process.cwd(), ".pgdata");
const firstRun = !existsSync(resolve(databaseDir, "PG_VERSION"));

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
