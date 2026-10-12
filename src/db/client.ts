// Database connection. DATABASE_URL picks the database: a local file in development
// (file:./data/zhaogong.db), an in-memory database in tests (file::memory:), a remote libSQL URL later.
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "@/db/schema";

export type Db = LibSQLDatabase<typeof schema>;

const DEFAULT_URL = "file:./data/zhaogong.db";

let client: Client | undefined;
let db: Db | undefined;

export function getDb(): Db {
  if (!db) {
    client = createClient({ url: process.env.DATABASE_URL ?? DEFAULT_URL, authToken: process.env.DATABASE_AUTH_TOKEN });
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
