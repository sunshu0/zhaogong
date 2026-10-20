// Tests only: make one kind of write fail, to check that the batch it is in leaves nothing behind (ADR 0031).
import { sql } from "drizzle-orm";
import type { Db } from "@/db/client";

let n = 0;

/**
 * A trigger that aborts every `op` on `table` (optionally only `when` its SQL condition holds, with NEW / OLD).
 * Returns the function that removes it.
 */
export async function failOn(
  db: Db,
  table: string,
  op: "INSERT" | "UPDATE" | "DELETE",
  when = "1",
): Promise<() => Promise<void>> {
  n += 1;
  const name = `test_fail_${n}`;
  await db.run(
    sql.raw(`CREATE TRIGGER ${name} BEFORE ${op} ON ${table} WHEN ${when} BEGIN SELECT RAISE(ABORT, '${name}'); END`),
  );
  return async () => {
    await db.run(sql.raw(`DROP TRIGGER ${name}`));
  };
}
