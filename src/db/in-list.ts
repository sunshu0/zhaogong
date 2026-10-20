// `column IN (list)` with the whole list as one parameter (ADR 0031). drizzle's inArray binds one parameter per value,
// and D1 refuses a statement with more than 100; a business with many jobs, or a person with many chats, gets there.
import { sql, type SQL } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";

/** `column IN (the values)`, binding the values as one JSON array. An empty list matches nothing. */
export function inList(column: SQLiteColumn, values: readonly (string | number)[]): SQL {
  return sql`${column} in (select value from json_each(${JSON.stringify(values)}))`;
}
