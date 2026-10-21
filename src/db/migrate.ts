// Applies the versioned SQL migrations in drizzle/ to the database getDb() points at.
import path from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type { MigrationConfig } from "drizzle-orm/migrator";
import { d1Binding, getDb, type Db } from "@/db/client";
import * as schema from "@/db/schema";

/** The libSQL migrator uses session.migrate (an atomic batch), not the excluded interactive transaction API. */
export async function migrateLocalDb(db: Db, config: MigrationConfig): Promise<void> {
  if (d1Binding()) throw new Error("Apply D1 migrations with Wrangler, not the libSQL migrator.");
  await migrate(db as LibSQLDatabase<typeof schema>, config);
}

export async function migrateDb(): Promise<void> {
  await migrateLocalDb(getDb(), { migrationsFolder: path.join(process.cwd(), "drizzle") });
}
