// Applies the versioned SQL migrations in drizzle/ to the database getDb() points at.
import path from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { getDb } from "@/db/client";

export async function migrateDb(): Promise<void> {
  await migrate(getDb(), { migrationsFolder: path.join(process.cwd(), "drizzle") });
}
