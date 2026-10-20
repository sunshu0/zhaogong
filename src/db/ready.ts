// The database as data.ts uses it: migrated once per server instance (and per test file), and loaded
// with the demo data when it is empty and DEMO_DATA asks for it. Doing this on first use, rather than in
// a start-up hook, also covers file::memory:, where every module instance has its own database.
import { d1Binding, databaseUrl, freshenD1ForTests, getDb, resetDbForTests, type Db } from "@/db/client";
import { migrateDb } from "@/db/migrate";
import { isDatabaseEmpty, seedDemoData } from "@/db/seed";

/**
 * DEMO_DATA: true by default in development and tests, false in production builds. Set DEMO_DATA=false to
 * develop on an empty database, or DEMO_DATA=true for a demo deployment.
 */
export function demoDataWanted(): boolean {
  const fallback = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test" ? "true" : "";
  return /^(1|true|yes)$/i.test(process.env.DEMO_DATA ?? fallback);
}

/**
 * EXTERNAL_JOBS: whether a fresh demo database imports the real external jobs (lib/external-jobs/demo-import.ts).
 * By default only on `next dev`: the test build (ZG_E2E=1), unit tests and production keep the made-up ones.
 * EXTERNAL_JOBS=demo keeps the made-up ones on `next dev` too; EXTERNAL_JOBS=real imports anywhere.
 */
export function realExternalJobsWanted(env: Record<string, string | undefined> = process.env): boolean {
  if (env.EXTERNAL_JOBS === "demo") return false;
  if (env.EXTERNAL_JOBS === "real") return true;
  return env.NODE_ENV === "development" && env.ZG_E2E !== "1";
}

/** In the background, so the first page does not wait for the companies' sites; it shows the made-up jobs meanwhile. */
function importRealExternalJobs(): void {
  if (!realExternalJobsWanted()) return;
  void import("@/lib/external-jobs/demo-import")
    .then(({ runDemoImport }) => runDemoImport())
    .then(
      (line) => console.log(line),
      (error) => console.error("External jobs: the import failed; the demo keeps its made-up ones.", error),
    );
}

/**
 * Whether the server migrates the database on first use (#329): a local file or a memory database, yes. A remote one
 * (Turso, libsql:// or https://) is migrated from the command line before a deploy (`npm run db:migrate` with its
 * DATABASE_URL and DATABASE_AUTH_TOKEN, docs/cloudflare-deployment.md): the migrator reads drizzle/ from disk, and a
 * Cloudflare Worker has no such folder, so migrating there would fail every page that reads the database.
 */
export function migratesOnFirstUse(url = databaseUrl()): boolean {
  return url.startsWith("file:");
}

/**
 * Whether an empty database takes the demo data on first use. Not on D1 (ADR 0031): the demo data is a few hundred
 * statements, more than one Worker request may run, so a D1 deployment loads it with a command before it opens
 * (docs/cloudflare-deployment.md). The D1 tests still load it on first use, as on libSQL.
 */
export function seedsOnFirstUse(onD1 = d1Binding() !== undefined): boolean {
  return demoDataWanted() && (!onD1 || process.env.NODE_ENV === "test");
}

async function prepare(): Promise<Db> {
  const onD1 = d1Binding() !== undefined;
  // D1 is migrated with wrangler before a deploy (docs/cloudflare-deployment.md); the tests' D1 here.
  if (onD1) await freshenD1ForTests();
  else if (migratesOnFirstUse()) {
    try {
      await migrateDb();
    } catch {
      // Two server instances can start migrating one file at the same moment; the second run finds
      // the migrations applied by the first and has nothing left to do.
      await migrateDb();
    }
  }
  if (seedsOnFirstUse(onD1) && (await isDatabaseEmpty())) {
    let loaded = false;
    try {
      await seedDemoData();
      loaded = true;
    } catch (error) {
      if (await isDatabaseEmpty()) throw error; // otherwise another instance loaded it first
    }
    if (loaded) importRealExternalJobs();
  }
  return getDb();
}

let ready: Promise<Db> | undefined;

/** The database, ready to read and write. */
export async function database(): Promise<Db> {
  ready ??= prepare().catch((error) => {
    ready = undefined;
    throw error;
  });
  const db = await ready;
  // On Cloudflare, the binding of the request at hand (getDb() keeps one drizzle instance per binding).
  return d1Binding() ? getDb() : db;
}

/** Tests only: start again from an empty, freshly migrated database on the next database() call. */
export function resetDatabaseForTests(): void {
  resetDbForTests();
  ready = undefined;
}
