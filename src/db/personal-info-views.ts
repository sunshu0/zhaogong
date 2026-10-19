// 审核员查看个人信息的记录 (#336, ADR 0026): each time /admin hands a moderator someone's personal information, one
// row says who, when, which kind and which record, never the information. The same moderator seeing the same record
// again within SAME_VIEW_MINUTES (the list loads again after each decision) is the same view. Kept KEEP_DAYS; no
// scheduled job (ADR 0008): the first record of a New Zealand day deletes the rows that are too old. Server only.
import { and, asc, desc, eq, gte, inArray, lt, type SQL } from "drizzle-orm";
import { database } from "@/db/ready";
import * as t from "@/db/schema";
import { lastDays, nzDay } from "@/db/job-stats";
import { LIST_LIMIT, type PersonalInfoKind } from "@/lib/personal-info-views";

/** How many days of records are kept (ADR 0026 §3). */
export const KEEP_DAYS = 365;
/** Seeing the same record again within this many minutes is not a new view. */
export const SAME_VIEW_MINUTES = 30;

export interface PersonalInfoView {
  at: string;
  moderator: string;
  kind: PersonalInfoKind;
  subjectId: string;
}

const second = (at: Date) => at.toISOString().slice(0, 19) + "Z";

let cleanedDay: string | undefined;

/**
 * Records that `moderator` was shown these records' personal information; returns how many rows were added. Call it
 * before the Server Function returns the information, so nothing reaches a moderator unrecorded.
 */
export async function recordViews(
  moderator: string,
  kind: PersonalInfoKind,
  subjectIds: readonly string[],
  now = new Date(),
): Promise<number> {
  const ids = [...new Set(subjectIds)];
  if (!ids.length) return 0;
  const db = await database();
  const day = nzDay(now);
  if (cleanedDay !== day) {
    cleanedDay = day;
    await db
      .delete(t.personalInfoViews)
      .where(lt(t.personalInfoViews.at, second(new Date(now.getTime() - KEEP_DAYS * 86_400_000))));
  }
  const recent = await db
    .select({ subjectId: t.personalInfoViews.subjectId })
    .from(t.personalInfoViews)
    .where(
      and(
        eq(t.personalInfoViews.moderator, moderator),
        eq(t.personalInfoViews.kind, kind),
        inArray(t.personalInfoViews.subjectId, ids),
        gte(t.personalInfoViews.at, second(new Date(now.getTime() - SAME_VIEW_MINUTES * 60_000))),
      ),
    );
  const seen = new Set(recent.map((r) => r.subjectId));
  const fresh = ids.filter((id) => !seen.has(id));
  if (fresh.length)
    await db
      .insert(t.personalInfoViews)
      .values(fresh.map((subjectId) => ({ at: second(now), day, moderator, kind, subjectId })));
  return fresh.length;
}

/**
 * The records of the last `days` New Zealand days, newest first, at most LIST_LIMIT; `more` when there were more.
 * `moderator` narrows them to one moderator (an email as stored, or deleted-account).
 */
export async function listViews(
  filter: { moderator?: string; days: number },
  now = new Date(),
): Promise<{ views: PersonalInfoView[]; more: boolean }> {
  const db = await database();
  const where: SQL[] = [gte(t.personalInfoViews.day, lastDays(now, filter.days)[0])];
  if (filter.moderator) where.push(eq(t.personalInfoViews.moderator, filter.moderator));
  const rows = await db
    .select({
      at: t.personalInfoViews.at,
      moderator: t.personalInfoViews.moderator,
      kind: t.personalInfoViews.kind,
      subjectId: t.personalInfoViews.subjectId,
    })
    .from(t.personalInfoViews)
    .where(and(...where))
    .orderBy(desc(t.personalInfoViews.at), desc(t.personalInfoViews.id))
    .limit(LIST_LIMIT + 1);
  return { views: rows.slice(0, LIST_LIMIT), more: rows.length > LIST_LIMIT };
}

/** Everyone with a record, for the page's moderator filter: moderators past and present, in order. */
export async function listViewModerators(): Promise<string[]> {
  const db = await database();
  const rows = await db
    .selectDistinct({ moderator: t.personalInfoViews.moderator })
    .from(t.personalInfoViews)
    .orderBy(asc(t.personalInfoViews.moderator));
  return rows.map((r) => r.moderator);
}

/** For tests: the next record cleans again, as on a new day. */
export function resetViewCleanupForTests(): void {
  cleanedDay = undefined;
}
