// The numbers an employer sees for each job (#55, R-31): page views (a browser once a day), people who started a
// chat, and contact views (contact_views, #11). Recorded here, read only through the employer's own Server
// Functions. Server only.
import { and, count, eq, gte, inArray } from "drizzle-orm";
import { database } from "@/db/ready";
import * as t from "@/db/schema";
import { normalizeEmail } from "@/components/seeker/session";

export interface JobNumbers {
  views: number;
  chats: number;
  contactViews: number;
}

export interface JobDay extends JobNumbers {
  /** YYYY-MM-DD in New Zealand. */
  day: string;
}

const nzDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Auckland" });

/** The New Zealand calendar day of a moment, YYYY-MM-DD. */
export function nzDay(at: Date): string {
  return nzDate.format(at);
}

/** The last `n` New Zealand days up to `now`, oldest first. */
export function lastDays(now: Date, n: number): string[] {
  const days = new Set<string>();
  // Step back in hours rather than days, so a daylight-saving change cannot skip or repeat a day.
  for (let h = 0; days.size < n; h += 1) days.add(nzDay(new Date(now.getTime() - h * 3_600_000)));
  return [...days].reverse();
}

/** Counts a browser's view of a job, once per New Zealand day. `visitor` is already hashed. */
export async function recordJobView(jobId: string, visitor: string, now = new Date()): Promise<void> {
  const db = await database();
  await db
    .insert(t.jobViews)
    .values({ jobId, day: nzDay(now), visitor })
    .onConflictDoNothing();
}

/** Counts a job seeker who started a chat about a job; the same person again changes nothing. */
export async function recordChatStart(jobId: string, email: string, now = new Date()): Promise<"counted" | "already"> {
  const seekerEmail = normalizeEmail(email);
  const db = await database();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ id: t.jobChatStarts.id })
      .from(t.jobChatStarts)
      .where(and(eq(t.jobChatStarts.jobId, jobId), eq(t.jobChatStarts.seekerEmail, seekerEmail)));
    if (row) return "already";
    await tx.insert(t.jobChatStarts).values({ jobId, seekerEmail, startedAt: now.toISOString() });
    return "counted";
  });
}

/** The job of a chat a job seeker opened from a job page (`employer:<business>:<job>`, see messages/actions.ts). */
export function jobOfConversation(conversationId: string): string | undefined {
  return /^employer:[^:]+:([^:]+)$/.exec(conversationId)?.[1];
}

/** Counts the sender of a message as having started a chat, when the chat is about a job. */
export async function countChatStart(conversationId: string, email: string, now = new Date()): Promise<void> {
  const jobId = jobOfConversation(conversationId);
  if (jobId) await recordChatStart(jobId, email, now);
}

/** All-time numbers for each of the jobs, zeros included. */
export async function jobNumbers(jobIds: string[]): Promise<Record<string, JobNumbers>> {
  const result: Record<string, JobNumbers> = Object.fromEntries(
    jobIds.map((id) => [id, { views: 0, chats: 0, contactViews: 0 }]),
  );
  if (!jobIds.length) return result;
  const db = await database();
  const tally = async (key: keyof JobNumbers, rows: Promise<{ jobId: string; n: number }[]>): Promise<void> => {
    for (const { jobId, n } of await rows) result[jobId][key] = n;
  };
  await tally(
    "views",
    db
      .select({ jobId: t.jobViews.jobId, n: count() })
      .from(t.jobViews)
      .where(inArray(t.jobViews.jobId, jobIds))
      .groupBy(t.jobViews.jobId),
  );
  await tally(
    "chats",
    db
      .select({ jobId: t.jobChatStarts.jobId, n: count() })
      .from(t.jobChatStarts)
      .where(inArray(t.jobChatStarts.jobId, jobIds))
      .groupBy(t.jobChatStarts.jobId),
  );
  await tally(
    "contactViews",
    db
      .select({ jobId: t.contactViews.jobId, n: count() })
      .from(t.contactViews)
      .where(inArray(t.contactViews.jobId, jobIds))
      .groupBy(t.contactViews.jobId),
  );
  return result;
}

/** The job's numbers for each of the last `n` New Zealand days, oldest first, days without any included. */
export async function jobDays(jobId: string, now = new Date(), n = 14): Promise<JobDay[]> {
  const days = lastDays(now, n);
  const byDay = new Map(days.map((day) => [day, { day, views: 0, chats: 0, contactViews: 0 }]));
  // A day and a half more than the window, so every moment of the oldest New Zealand day is read.
  const since = new Date(now.getTime() - (n + 1.5) * 86_400_000).toISOString();
  const db = await database();

  const views = await db
    .select({ day: t.jobViews.day, n: count() })
    .from(t.jobViews)
    .where(and(eq(t.jobViews.jobId, jobId), gte(t.jobViews.day, days[0])))
    .groupBy(t.jobViews.day);
  for (const row of views) {
    const entry = byDay.get(row.day);
    if (entry) entry.views = row.n;
  }
  const add = (at: string, key: "chats" | "contactViews") => {
    const entry = byDay.get(nzDay(new Date(at)));
    if (entry) entry[key] += 1;
  };
  const chats = await db
    .select({ at: t.jobChatStarts.startedAt })
    .from(t.jobChatStarts)
    .where(and(eq(t.jobChatStarts.jobId, jobId), gte(t.jobChatStarts.startedAt, since)));
  for (const { at } of chats) add(at, "chats");
  const contact = await db
    .select({ at: t.contactViews.viewedAt })
    .from(t.contactViews)
    .where(and(eq(t.contactViews.jobId, jobId), gte(t.contactViews.viewedAt, since)));
  for (const { at } of contact) add(at, "contactViews");

  return [...byDay.values()];
}
