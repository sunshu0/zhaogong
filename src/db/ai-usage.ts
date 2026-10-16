// AI 发帖用量 (#102, ADR 0018): each call to the posting model is a row in ai_usage, with its tokens and how it ended.
// The limits (limits.ts) count an account's calls here, and 审核数据 adds up the last seven days. Server only.
import { and, asc, count, eq, gte, ne } from "drizzle-orm";
import { database } from "@/db/ready";
import * as t from "@/db/schema";
import { normalizeEmail } from "@/components/seeker/session";
import { limitWindows, type AiCallCounts, type AiUsageResult } from "@/lib/ai-post/model/limits";
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
