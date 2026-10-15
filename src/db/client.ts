// Database connection. DATABASE_URL picks the database: a local libSQL file by default
// (file:./data/zhaogong.db, relative to the project), file::memory: for tests and throw-away servers,
// or a remote libSQL URL later (with DATABASE_AUTH_TOKEN).
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { oneAtATime } from "@/db/one-at-a-time";
import * as schema from "@/db/schema";

export type Db = LibSQLDatabase<typeof schema>;

const DEFAULT_URL = "file:./data/zhaogong.db";

/**
 * The project folder, where drizzle/ and data/ are. Servers and tests run from it; paths built from it stay
 * statically scoped (process.cwd() plus a fixed folder), so the build traces only those folders.
 */
export function projectRoot(): string {
  return process.cwd();
}

/** The URL getDb() opens: DATABASE_URL, or the project's local file. */
export function databaseUrl(): string {
  return process.env.DATABASE_URL || DEFAULT_URL;
}

/** The local file behind a file: URL (relative to the project folder); undefined for memory and remote databases. */
export function localDatabaseFile(url = databaseUrl()): string | undefined {
  if (!url.startsWith("file:") || url.includes(":memory:")) return undefined;
  const file = url.slice("file:".length);
  // The database file is data, not code: keep it (and the rest of the project) out of the build's file tracing.
  return path.isAbsolute(file) ? file : path.join(/*turbopackIgnore: true*/ process.cwd(), file);
}

let client: Client | undefined;
let db: Db | undefined;

/** The connection, opened on first use. Most code wants `database()` (src/db/ready.ts), which also migrates. */
export function getDb(): Db {
  if (!db) {
    const url = databaseUrl();
    // libSQL creates the file but not its folder (data/ is not in git).
    const file = localDatabaseFile(url);
    if (file) mkdirSync(path.dirname(file), { recursive: true });
    client = oneAtATime(createClient({ url: file ? `file:${file}` : url, authToken: process.env.DATABASE_AUTH_TOKEN }));
    db = drizzle(client, { schema });
  }
  return db;
}

/** Tests only: drop the connection so the next getDb() opens a fresh database. */
export function resetDbForTests(): void {
  client?.close();
  client = undefined;
  db = undefined;
}
