// Database connection (ADR 0005, ADR 0031). On Cloudflare the Worker's D1 binding `DB` is the database. Everywhere
// else DATABASE_URL picks a libSQL database: a local file by default (file:./data/zhaogong.db, relative to the
// project), or file::memory: for tests and throw-away servers. libSQL runs under D1's rules (src/db/d1-rules.ts), so
// code that works locally works on D1.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { d1Rules } from "@/db/d1-rules";
import { oneAtATime } from "@/db/one-at-a-time";
import * as schema from "@/db/schema";

// Both drivers have the same query builder and `batch`; the code is written against libSQL's type.
export type Db = Omit<LibSQLDatabase<typeof schema>, "transaction">;

/** The D1 binding as the Worker hands it over (a D1Database). */
export type D1Binding = Parameters<typeof drizzleD1>[0];

const DEFAULT_URL = "file:./data/zhaogong.db";

/**
 * The project folder, where drizzle/ and data/ are. Servers and tests run from it; paths built from it stay
 * statically scoped (process.cwd() plus a fixed folder), so the build traces only those folders.
 */
export function projectRoot(): string {
  return process.cwd();
}

/** The URL getDb() opens with libSQL: DATABASE_URL, or the project's local file. */
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

// OpenNext keeps the request's Cloudflare context (env, ctx) under this symbol (@opennextjs/cloudflare,
// getCloudflareContext). Reading it directly keeps the package out of the Node server, where it is not installed.
const CLOUDFLARE_CONTEXT = Symbol.for("__cloudflare-context__");

let testD1: { binding: D1Binding; freshen: () => Promise<void> } | undefined;
let testD1Stale = true;

/**
 * The D1 database, when there is one: the Worker's `DB` binding (unless DATABASE_URL asks for libSQL), or the one the
 * D1 tests put in (vitest.d1.config.mts).
 */
export function d1Binding(): D1Binding | undefined {
  if (testD1) return testD1.binding;
  if (process.env.DATABASE_URL) return undefined;
  const context = (globalThis as Record<symbol, { env?: { DB?: D1Binding } } | undefined>)[CLOUDFLARE_CONTEXT];
  return context?.env?.DB;
}

/**
 * Tests only: run on this D1 database instead of libSQL (undefined goes back to libSQL). `freshen` empties and migrates
 * it; it runs before the first use and after each reset, as a fresh file::memory: database would.
 */
export function setD1ForTests(binding: D1Binding | undefined, freshen: () => Promise<void> = async () => {}): void {
  testD1 = binding && { binding, freshen };
  testD1Stale = true;
}

/** Tests only: freshens the tests' D1 database when it was reset since (src/db/ready.ts calls it). */
export async function freshenD1ForTests(): Promise<void> {
  if (!testD1 || !testD1Stale) return;
  testD1Stale = false;
  await testD1.freshen();
}

const d1Databases = new WeakMap<object, Db>();

let client: Client | undefined;
let db: Db | undefined;

/** The connection, opened on first use. Most code wants `database()` (src/db/ready.ts), which also migrates. */
export function getDb(): Db {
  const binding = d1Binding();
  if (binding) {
    let d1 = d1Databases.get(binding);
    if (!d1) {
      d1 = drizzleD1(binding, { schema }) as unknown as Db;
      d1Databases.set(binding, d1);
    }
    return d1;
  }
  if (!db) {
    const url = databaseUrl();
    // libSQL creates the file but not its folder (data/ is not in git).
    const file = localDatabaseFile(url);
    if (file) mkdirSync(path.dirname(file), { recursive: true });
    client = oneAtATime(
      d1Rules(createClient({ url: file ? `file:${file}` : url, authToken: process.env.DATABASE_AUTH_TOKEN })),
    );
    db = drizzle(client, { schema });
  }
  return db;
}

/** Tests only: drop the connection so the next getDb() opens a fresh database. */
export function resetDbForTests(preserveD1 = false): void {
  if (!preserveD1) testD1Stale = true;
  client?.close();
  client = undefined;
  db = undefined;
}
