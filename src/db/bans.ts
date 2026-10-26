// Employer bans in SQL (ADR 0044): the same rule as isBanned (src/lib/employer-ban.ts), for queries and for writes
// that must not race a ban. A temporary ban is over once banned_until is at or before the time given.
import { sql, type SQL } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import * as t from "@/db/schema";

// The business is looked up under its own name: `id` may be a column of the outer query's employers, which inside the
// subquery would otherwise mean the inner table's own id (and match every row). Written out, since drizzle's alias()
// in a sql`` template renders only the alias, not `employers as …`.
const ban = (column: string) => sql.raw(`"ban_check"."${column}"`);

/** SQL: the business `id` (a value or a column) is not banned at `nowIso`. */
export function employerNotBannedSql(id: SQL | SQLiteColumn | string, nowIso: string): SQL {
  return sql`exists (select 1 from ${t.employers} as "ban_check" where ${ban("id")} = ${id} and (${ban("banned_at")} is null or (${ban("banned_until")} is not null and ${ban("banned_until")} <= ${nowIso})))`;
}
