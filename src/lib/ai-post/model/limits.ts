// How much each account may ask the posting model (#102, ADR 0018), so one account cannot run up the bill or keep
// the model busy: 6 calls a minute, 100 a day (the last 24 hours). Only calls to a model count (Claude and the fake
// that stands in for it in tests), never the script. Pure: src/db/ai-usage.ts counts the calls from ai_usage.

export const AI_LIMITS = { perMinute: 6, perDay: 100 } as const;

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

/**
 * How a call to the posting model ended; `limited` is one the limits turned away before it was made. `pending`: the
 * call's place is taken (reserveAiCall) and its answer not yet in; one left pending (the server stopped mid-call)
 * keeps counting against the limits and shows in 审核数据 as failed.
 */
export type AiUsageResult = "ok" | "error" | "refused" | "unreadable" | "limited" | "pending";

/** The account's calls since each window began. */
export interface AiCallCounts {
  lastMinute: number;
  lastDay: number;
}

/** Where the two windows begin, for counting. */
export function limitWindows(now: Date): { minute: Date; day: Date } {
  return { minute: new Date(now.getTime() - MINUTE_MS), day: new Date(now.getTime() - DAY_MS) };
}

/** Which limit one more call would go over, if any. */
export function overLimit(counts: AiCallCounts): "minute" | "day" | undefined {
  if (counts.lastDay >= AI_LIMITS.perDay) return "day";
  if (counts.lastMinute >= AI_LIMITS.perMinute) return "minute";
  return undefined;
}

export const LIMITED_ZH = {
  minute: "说得有点快，AI 发帖助手一分钟最多回答 6 句。请稍等一会儿再发，或者点「改用直接填表」。",
  day: "今天和 AI 发帖助手说的已经到 100 句上限了，明天再继续。现在可以点「改用直接填表」，把招聘内容填进表单发布。",
  signedOut: "登录后才能用 AI 发帖助手。也可以点「改用直接填表」先把招聘内容写好，发布前再登录。",
} as const;
