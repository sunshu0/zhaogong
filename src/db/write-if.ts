// Writes that decide inside the statement (ADR 0031). D1 has no interactive transactions, so "check, then write"
// becomes one statement whose condition the database checks at the moment it writes: nobody can slip in between.
import { getTableColumns, is, sql, SQL } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import type { Db } from "@/db/client";
import { D1_MAX_PARAMETERS } from "@/db/d1-rules";

/** A row to insert; any value may be SQL, worked out by the database when it writes (a next id, say). */
export type RowOrSql<T extends SQLiteTable> = { [K in keyof T["$inferInsert"]]?: T["$inferInsert"][K] | SQL };

function columnValue(column: SQLiteColumn, value: unknown): SQL {
  if (is(value, SQL)) return value;
  if (value !== undefined) return sql`${sql.param(value, column)}`;
  const fallback = column.defaultFn?.() ?? column.default;
  if (is(fallback, SQL)) return fallback;
  return sql`${sql.param(fallback ?? null, column)}`;
}

/**
 * `INSERT INTO table (…) SELECT … WHERE condition`: the row goes in only if the condition holds when the database
 * writes it. Add `.returning()` to learn whether it did. Missing values take the column's default, as `.values()` does.
 */
export function insertIf<T extends SQLiteTable>(db: Db, table: T, row: RowOrSql<T>, condition: SQL) {
  const values = Object.entries(getTableColumns(table))
    .filter(([, column]) => !column.shouldDisableInsert())
    .map(([key, column]) => columnValue(column, (row as Record<string, unknown>)[key]));
  return db.insert(table).select(sql`select ${sql.join(values, sql`, `)} where ${condition}`);
}

/**
 * The next id with this prefix, worked out by the database in the statement that inserts the row: `j20` after `j19`.
 * Taking the id and inserting in one statement means two requests never get the same one (ADR 0005, ADR 0031).
 */
export function nextIdSql(table: SQLiteTable, column: SQLiteColumn, prefix: string): SQL {
  return sql`(select ${prefix} || (coalesce(max(cast(substr(${column}, ${prefix.length + 1}) as integer)), 0) + 1) from ${table} where ${column} glob ${`${prefix}[0-9]*`})`;
}

/**
 * Inserts for many rows, each statement under D1's 100 bound parameters (ADR 0031). Run them with `db.batch` so the
 * rows go in together or not at all.
 */
export function insertsInChunks<T extends SQLiteTable>(db: Db, table: T, rows: T["$inferInsert"][]) {
  // Every column may take a parameter in a row (drizzle fills in defaults from code), so count them all.
  const perRow = Object.keys(getTableColumns(table)).length;
  const size = Math.max(1, Math.floor(D1_MAX_PARAMETERS / perRow));
  const inserts = [];
  for (let i = 0; i < rows.length; i += size) inserts.push(db.insert(table).values(rows.slice(i, i + size)));
  return inserts;
}
