// A condition checked once for an atomic group of writes (ADR 0031). The guard is removed in the same batch,
// so no token survives either a successful write, a refused condition, or a rollback.
import { randomUUID } from "node:crypto";
import { eq, sql, type SQL } from "drizzle-orm";
import type { BatchItem, BatchResponse } from "drizzle-orm/batch";
import type { Db } from "@/db/client";
import { writeGuards } from "@/db/schema";
import { insertIf } from "@/db/write-if";

export async function guardedBatch<T extends readonly [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]>(
  db: Db,
  condition: SQL,
  writes: (allowed: SQL) => T,
): Promise<{ applied: boolean; results: BatchResponse<T> }> {
  const token = randomUUID();
  const allowed = sql`exists (select 1 from ${writeGuards} where ${writeGuards.token} = ${token})`;
  const results = await db.batch([
    insertIf(db, writeGuards, { token }, condition),
    ...writes(allowed),
    db.delete(writeGuards).where(eq(writeGuards.token, token)).returning(),
  ]);
  const removed = results.at(-1) as { token: string }[];
  return { applied: removed.length === 1, results: results.slice(1, -1) as BatchResponse<T> };
}
