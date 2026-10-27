// Offline bootstrap for a fresh demo D1 database. Always use a new in-memory database: DATABASE_URL, local
// developer data and any deployed database are deliberately not inputs. This module is a Node-only CLI tool.
import { createClient } from "@libsql/client";
import { getTableName, is } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { SQLiteTable } from "drizzle-orm/sqlite-core";
import { readFileSync } from "node:fs";
import { seedDemoData } from "@/db/seed";
import * as schema from "@/db/schema";
import { MOCK_JOBS } from "@/mock/data";

const DAY = 86_400_000;

function identifier(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

/**
 * The tables in an order where each comes after every table its foreign keys point to, so a file of INSERTs in this
 * order passes foreign key checks statement by statement (D1's remote import does not honour
 * `PRAGMA defer_foreign_keys`: B-17). Ties go by name, so the order only changes with the schema. A cycle between
 * tables, or a table that points to itself, has no such order: the export stops and says so.
 */
export function parentsFirst(parents: ReadonlyMap<string, readonly string[]>): string[] {
  const order: string[] = [];
  const done = new Set<string>();
  const visiting: string[] = [];
  const visit = (table: string) => {
    if (done.has(table)) return;
    if (visiting.includes(table)) {
      const cycle = [...visiting.slice(visiting.indexOf(table)), table].join(" → ");
      throw new Error(`Foreign keys form a cycle (${cycle}): the demo export cannot put parent rows first.`);
    }
    visiting.push(table);
    for (const parent of [...(parents.get(table) ?? [])].sort()) visit(parent);
    visiting.pop();
    done.add(table);
    order.push(table);
  };
  for (const table of [...parents.keys()].sort()) visit(table);
  return order;
}

/** Each table's parents: the tables its foreign keys point to, read from the migrated database. */
async function foreignKeyParents(client: ReturnType<typeof createClient>, tables: string[]) {
  const parents = new Map<string, string[]>();
  for (const table of tables) {
    const keys = await client.execute(`PRAGMA foreign_key_list(${identifier(table)})`);
    parents.set(
      table,
      [...new Set(keys.rows.map((key) => String(key.table)))].filter((parent) => tables.includes(parent)),
    );
  }
  return parents;
}

/** The last migration in drizzle/ (its journal tag, e.g. 0038_moderator_changes), for the file's header. */
function lastMigration(): string {
  const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as { entries: { tag: string }[] };
  return journal.entries.at(-1)!.tag;
}

/**
 * The fixed-date fixtures (src/mock: the jobs j1–j19 and their contact views, dated back from 2026-10-11) moved
 * forward by whole days so the newest is posted on the day of the export: a demo site imported weeks later still
 * lists open jobs. What is expired by its status stays expired, and its end date stays before the export (moved,
 * it would fall days after it); the rest of the demo is dated from `now` already.
 */
async function moveFixedDatesToNow(client: ReturnType<typeof createClient>, now: number): Promise<number> {
  const newest = Math.max(...MOCK_JOBS.map((job) => Date.parse(job.postedAt)));
  const shift = Math.max(0, Math.floor((now - newest) / DAY)) * DAY;
  if (!shift) return 0;
  const later = (value: unknown) => (value == null ? null : new Date(Date.parse(String(value)) + shift).toISOString());
  const ended = (value: unknown) => new Date(Math.min(Date.parse(String(value)) + shift, now - DAY)).toISOString();
  const ids = MOCK_JOBS.map((job) => job.id);
  const marks = ids.map(() => "?").join(", ");
  const jobs = await client.execute({
    sql: `SELECT id, status, posted_at, expires_at, hires_confirmed_at FROM jobs WHERE id IN (${marks})`,
    args: ids,
  });
  const views = await client.execute({
    sql: `SELECT id, viewed_at FROM contact_views WHERE job_id IN (${marks})`,
    args: ids,
  });
  await client.batch(
    [
      ...jobs.rows.map((job) => ({
        sql: "UPDATE jobs SET posted_at = ?, expires_at = ?, hires_confirmed_at = ? WHERE id = ?",
        args: [
          later(job.posted_at),
          job.status === "expired" ? ended(job.expires_at) : later(job.expires_at),
          later(job.hires_confirmed_at),
          job.id,
        ],
      })),
      ...views.rows.map((view) => ({
        sql: "UPDATE contact_views SET viewed_at = ? WHERE id = ?",
        args: [later(view.viewed_at), view.id],
      })),
    ],
    "write",
  );
  return shift / DAY;
}

/** Only synthetic fixtures, with SQL literals quoted by SQLite itself. No schema, sessions or migration history. */
export async function demoDataSql(now = Date.now()): Promise<{ sql: string; statements: string[]; rows: number }> {
  const client = createClient({ url: "file::memory:" });
  try {
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "drizzle" });
    await seedDemoData(db, now);
    const movedDays = await moveFixedDatesToNow(client, now);
    const tables = Object.values(schema)
      .filter((value) => is(value, SQLiteTable))
      .map(getTableName)
      .sort();
    const ordered = parentsFirst(await foreignKeyParents(client, tables));
    const header = [
      `-- Zhaogong synthetic demo fixtures. Apply migrations 0000-${lastMigration()} first.`,
      `-- Dated for ${new Date(now).toISOString().slice(0, 10)}: the fixed-date demo jobs were moved ${movedDays} days forward.`,
      "-- Import into an EMPTY DEMO DATABASE ONLY with wrangler d1 execute --file.",
      "-- No user database was read. Do not use this file for production onboarding.",
    ];
    // Kept for local imports; the order below no longer needs it (D1's remote import ignores it: B-17).
    const statements = [
      "PRAGMA defer_foreign_keys = on;",
      // The NOT NULL constraint aborts the import if any application table already has data, including tables
      // that seedDemoData's employer-only empty check would miss. This writes zero rows on an empty database.
      `INSERT INTO "write_guards" ("token") SELECT NULL WHERE ${tables.map((table) => `EXISTS (SELECT 1 FROM ${identifier(table)})`).join(" OR ")};`,
    ];
    let rows = 0;
    for (const table of ordered) {
      const info = await client.execute(`PRAGMA table_info(${identifier(table)})`);
      const columns = info.rows.map((column) => identifier(String(column.name)));
      const quoted = await client.execute(
        `SELECT ${columns.map((column) => `quote(${column})`).join(", ")} FROM ${identifier(table)}`,
      );
      for (const row of quoted.rows) {
        statements.push(
          `INSERT INTO ${identifier(table)} (${columns.join(", ")}) VALUES (${Array.from(row).join(", ")});`,
        );
        rows++;
      }
    }
    return { sql: `${[...header, ...statements].join("\n")}\n`, statements, rows };
  } finally {
    client.close();
  }
}
