// 老板活跃度 on job cards and job pages (#381, ADR 0038): 今天在线 and, only when it is fast, how soon the business
// usually replies. Public pages say no more than that: never a time of day, never "N days ago", never who in the
// team, never a slow reply. Pure: the rows come from src/db/employer-activity.ts.
import { aucklandDay } from "@/lib/chat-activity";

/** What a job card and a job page may say about a business; an empty object says nothing. */
export type EmployerActivity = { onlineToday?: true; replies?: ReplySpeed };
/** 通常 1 小时内回复, 通常当天内回复 (within 24 hours); nothing slower is shown. */
export type ReplySpeed = "hour" | "day";

/** The conversations counted: the ones opened in the last 30 days. */
export const REPLY_WINDOW_MS = 30 * 86_400_000;
/** Fewer conversations than this say nothing about reply speed. */
export const REPLY_SAMPLE_MIN = 5;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/**
 * One conversation a job seeker started (their message came first): when they first wrote, and when the business
 * (anyone in its team) first answered after it, or null.
 */
export type FirstReply = { askedAt: string; repliedAt: string | null };

/** Whether `lastActiveAt` is on the same day as `now` in New Zealand. */
export function activeToday(lastActiveAt: string | null | undefined, now: number): boolean {
  const at = lastActiveAt ? Date.parse(lastActiveAt) : NaN;
  return Number.isFinite(at) && at <= now && aucklandDay(at) === aucklandDay(now);
}

/**
 * How soon the business usually answers a job seeker's first message: the median wait over the conversations of the
 * window, taking the later of the two middle ones for an even count. A conversation with no answer counts as slow
 * once a day has passed; until then it is left out. Undefined with fewer than REPLY_SAMPLE_MIN conversations, or
 * when the median is over a day.
 */
export function replySpeed(conversations: FirstReply[], now: number): ReplySpeed | undefined {
  const waits: number[] = [];
  for (const { askedAt, repliedAt } of conversations) {
    const asked = Date.parse(askedAt);
    if (!Number.isFinite(asked) || asked > now || now - asked > REPLY_WINDOW_MS) continue;
    const replied = repliedAt ? Date.parse(repliedAt) : NaN;
    if (Number.isFinite(replied) && replied >= asked) waits.push(replied - asked);
    else if (now - asked >= DAY_MS) waits.push(Infinity);
  }
  if (waits.length < REPLY_SAMPLE_MIN) return undefined;
  const median = waits.sort((a, b) => a - b)[Math.floor(waits.length / 2)];
  return median <= HOUR_MS ? "hour" : median <= DAY_MS ? "day" : undefined;
}

export function employerActivity(
  input: { lastActiveAt?: string | null; conversations: FirstReply[] },
  now: number,
): EmployerActivity {
  const replies = replySpeed(input.conversations, now);
  return {
    ...(activeToday(input.lastActiveAt, now) ? { onlineToday: true as const } : {}),
    ...(replies ? { replies } : {}),
  };
}
