// The database as data.ts uses it: migrated once per server instance (and per test file), and loaded
// with the demo data when it is empty and DEMO_DATA asks for it. Doing this on first use, rather than in
// a start-up hook, also covers file::memory:, where every module instance has its own database.
import { getDb, resetDbForTests, type Db } from "@/db/client";
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

async function prepare(): Promise<Db> {
  try {
    await migrateDb();
  } catch {
    // Two server instances can start migrating one file at the same moment; the second run finds
    // the migrations applied by the first and has nothing left to do.
    await migrateDb();
  }
  if (demoDataWanted() && (await isDatabaseEmpty())) {
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
export function database(): Promise<Db> {
  ready ??= prepare().catch((error) => {
    ready = undefined;
    throw error;
  });
  return ready;
}

/** Tests only: start again from an empty, freshly migrated database on the next database() call. */
export function resetDatabaseForTests(): void {
  resetDbForTests();
  ready = undefined;
}
