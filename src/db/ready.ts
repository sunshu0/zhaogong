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

async function prepare(): Promise<Db> {
  try {
    await migrateDb();
  } catch {
    // Two server instances can start migrating one file at the same moment; the second run finds
    // the migrations applied by the first and has nothing left to do.
    await migrateDb();
  }
  if (demoDataWanted() && (await isDatabaseEmpty())) {
    try {
      await seedDemoData();
    } catch (error) {
      if (await isDatabaseEmpty()) throw error; // otherwise another instance loaded it first
    }
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
