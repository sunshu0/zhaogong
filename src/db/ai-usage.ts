// AI 发帖用量 (#102, ADR 0018): each call to the posting model is a row in ai_usage, with its tokens and how it ended.
// The limits (limits.ts) count an account's calls here, and 审核数据 adds up the last seven days. Server only.
import { and, asc, count, eq, gte, ne, sql } from "drizzle-orm";
import { database } from "@/db/ready";
import * as t from "@/db/schema";
import { insertIf } from "@/db/write-if";
import { normalizeEmail } from "@/components/seeker/session";
import { AI_LIMITS, limitWindows, overLimit, type AiCallCounts, type AiUsageResult } from "@/lib/ai-post/model/limits";
import type { TokenUsage } from "@/lib/ai-post/model/turn";

export interface AiUsageRow {
  at: string;
  model: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  result: AiUsageResult;
}

export async function recordAiUsage(
  email: string,
  call: { model: string; usage?: TokenUsage; result: AiUsageResult },
  now = new Date(),
): Promise<void> {
  const db = await database();
  await db.insert(t.aiUsage).values({
    email: normalizeEmail(email),
    at: now.toISOString(),
    model: call.model,
    inputTokens: call.usage?.input ?? 0,
    outputTokens: call.usage?.output ?? 0,
    cacheReadTokens: call.usage?.cacheRead ?? 0,
    cacheWriteTokens: call.usage?.cacheWrite ?? 0,
    result: call.result,
  });
}

/**
 * Takes a call's place before the model is asked (security review B): one statement inserts a `pending` row only
 * while the account has made fewer than AI_LIMITS calls in the last minute and the last 24 hours, so requests sent
 * at once cannot all pass the check before any is counted (ADR 0031's insertIf). The row's id to fill in with
 * finishAiCall; or which limit was reached, and then a `limited` row is recorded instead, as before.
 */
export async function reserveAiCall(
  email: string,
  model: string,
  now = new Date(),
): Promise<{ id: number } | { over: "minute" | "day" }> {
  const address = normalizeEmail(email);
  const { minute, day } = limitWindows(now);
  const calls = (from: Date) =>
    sql`(select count(*) from ${t.aiUsage} where ${t.aiUsage.email} = ${address} and ${t.aiUsage.at} >= ${from.toISOString()} and ${t.aiUsage.result} <> 'limited')`;
  const db = await database();
  const [row] = await insertIf(
    db,
    t.aiUsage,
    {
      email: address,
      at: now.toISOString(),
      model,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      result: "pending",
    },
    sql`${calls(day)} < ${AI_LIMITS.perDay} and ${calls(minute)} < ${AI_LIMITS.perMinute}`,
  ).returning({ id: t.aiUsage.id });
  if (row) return { id: row.id };
  await recordAiUsage(address, { model, result: "limited" }, now);
  return { over: overLimit(await countAiCalls(address, now)) ?? "minute" };
}

/** How the call whose place reserveAiCall took ended, with its tokens. */
export async function finishAiCall(
  id: number,
  call: { usage?: TokenUsage; result: Exclude<AiUsageResult, "limited" | "pending"> },
): Promise<void> {
  const db = await database();
  await db
    .update(t.aiUsage)
    .set({
      inputTokens: call.usage?.input ?? 0,
      outputTokens: call.usage?.output ?? 0,
      cacheReadTokens: call.usage?.cacheRead ?? 0,
      cacheWriteTokens: call.usage?.cacheWrite ?? 0,
      result: call.result,
    })
    .where(eq(t.aiUsage.id, id));
}

/** The account's calls in the last minute and the last 24 hours; calls the limits turned away do not count. */
export async function countAiCalls(email: string, now = new Date()): Promise<AiCallCounts> {
  const { minute, day } = limitWindows(now);
  const db = await database();
  const since = async (from: Date) => {
    const [{ n }] = await db
      .select({ n: count() })
      .from(t.aiUsage)
      .where(
        and(
          eq(t.aiUsage.email, normalizeEmail(email)),
          gte(t.aiUsage.at, from.toISOString()),
          ne(t.aiUsage.result, "limited"),
        ),
      );
    return n;
  };
  return { lastMinute: await since(minute), lastDay: await since(day) };
}

/** Every row since `from`, oldest first, without whose they were (审核数据 shows totals only). */
export async function listAiUsageSince(from: Date): Promise<AiUsageRow[]> {
  const db = await database();
  const rows = await db
    .select()
    .from(t.aiUsage)
    .where(gte(t.aiUsage.at, from.toISOString()))
    .orderBy(asc(t.aiUsage.at));
  return rows.map(toRow);
}

/** One account's rows, oldest first, for 导出我的数据. */
export async function listAiUsageOf(email: string): Promise<AiUsageRow[]> {
  const db = await database();
  const rows = await db
    .select()
    .from(t.aiUsage)
    .where(eq(t.aiUsage.email, normalizeEmail(email)))
    .orderBy(asc(t.aiUsage.at));
  return rows.map(toRow);
}

function toRow(row: typeof t.aiUsage.$inferSelect): AiUsageRow {
  return {
    at: row.at,
    model: row.model,
    input: row.inputTokens,
    output: row.outputTokens,
    cacheRead: row.cacheReadTokens,
    cacheWrite: row.cacheWriteTokens,
    result: row.result,
  };
}
