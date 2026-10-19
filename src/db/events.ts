// The funnel events (#312, ADR 0025 §3): one row each, at most PER_DAY of one kind from one visitor in a day, kept
// for KEEP_DAYS. No scheduled job (ADR 0008): the first event of a day deletes the rows that are too old. The
// reports read this table (审核后台, #316). Server only.
import { and, count, eq, lt } from "drizzle-orm";
import { database } from "@/db/ready";
import * as t from "@/db/schema";
import { lastDays, nzDay } from "@/db/job-stats";
import type { Lang } from "@/i18n/lang";
import type { EventInput } from "@/lib/events/catalog";

/** How many days of events are kept. */
export const KEEP_DAYS = 180;
/** The most events of one kind one visitor records in a day; more are dropped (a page reloaded over and over). */
export const PER_DAY = 30;

export interface EventRow extends EventInput {
  /** visitorKey(): already an HMAC. */
  visitor: string;
  lang: Lang;
  role: "out" | "seeker" | "employer";
}

let cleanedDay: string | undefined;

/** Stores one event; "capped" when this visitor already has PER_DAY of this kind today. */
export async function recordEvent(event: EventRow, now = new Date()): Promise<"recorded" | "capped"> {
  const db = await database();
  const day = nzDay(now);
  if (cleanedDay !== day) {
    cleanedDay = day;
    // The oldest day kept is the first of the last KEEP_DAYS days; anything before it goes.
    await db.delete(t.events).where(lt(t.events.day, lastDays(now, KEEP_DAYS)[0]));
  }
  const [{ n }] = await db
    .select({ n: count() })
    .from(t.events)
    .where(and(eq(t.events.visitor, event.visitor), eq(t.events.day, day), eq(t.events.name, event.name)));
  if (n >= PER_DAY) return "capped";
  await db.insert(t.events).values({
    name: event.name,
    at: now.toISOString().slice(0, 19) + "Z",
    day,
    visitor: event.visitor,
    path: event.path,
    lang: event.lang,
    role: event.role,
    jobId: event.jobId ?? null,
    detail: event.detail ?? null,
  });
  return "recorded";
}

/** For tests: the next event cleans again, as on a new day. */
export function resetEventCleanupForTests(): void {
  cleanedDay = undefined;
}
