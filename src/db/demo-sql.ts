// Offline bootstrap for a fresh demo D1 database. Always use a new in-memory database: DATABASE_URL, local
// developer data and any deployed database are deliberately not inputs. This module is a Node-only CLI tool.
import { createClient } from "@libsql/client";
import { getTableName, is } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { SQLiteTable } from "drizzle-orm/sqlite-core";
import { seedDemoData } from "@/db/seed";
import * as schema from "@/db/schema";

function identifier(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

/** Only synthetic fixtures, with SQL literals quoted by SQLite itself. No schema, sessions or migration history. */
export async function demoDataSql(now = Date.now()): Promise<{ sql: string; statements: string[]; rows: number }> {
  const client = createClient({ url: "file::memory:" });
  try {
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "drizzle" });
    await seedDemoData(db, now);
    const tables = Object.values(schema)
      .filter((value) => is(value, SQLiteTable))
      .map(getTableName)
      .sort();
    const header = [
      "-- Zhaogong synthetic demo fixtures. Apply migrations 0000-0031 first.",
      "-- Import into an EMPTY DEMO DATABASE ONLY with wrangler d1 execute --file.",
      "-- No user database was read. Do not use this file for production onboarding.",
    ];
    const statements = [
      "PRAGMA defer_foreign_keys = on;",
      // The NOT NULL constraint aborts the import if any application table already has data, including tables
      // that seedDemoData's employer-only empty check would miss. This writes zero rows on an empty database.
      `INSERT INTO "write_guards" ("token") SELECT NULL WHERE ${tables.map((table) => `EXISTS (SELECT 1 FROM ${identifier(table)})`).join(" OR ")};`,
    ];
    let rows = 0;
    for (const table of tables) {
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
