// 举报附证据 (ADR 0027): the messages a job report carries, copied from the reporter's own chats with the job's
// business when they report, and (second PR) screenshots. Only moderators see them. Kept EVIDENCE_KEEP_DAYS after the
// report is handled; no scheduled job (ADR 0008): the first report of a New Zealand day deletes what is too old.
// Server only.
import { and, asc, desc, eq, inArray, isNotNull, lt, ne } from "drizzle-orm";
import { database } from "@/db/ready";
import * as t from "@/db/schema";
import { nzDay } from "@/db/job-stats";
import { evidenceStore } from "@/db/evidence-store";
import { normalizeEmail } from "@/components/seeker/session";
import {
  EVIDENCE_KEEP_DAYS,
  PICKABLE_MESSAGES_MAX,
  type EvidenceMessage,
  type PickableMessage,
} from "@/lib/report-evidence";

/** One piece of a report's evidence, as /admin shows it. */
export type ReportEvidence =
  | ({ kind: "message"; createdAt: string } & EvidenceMessage)
  | { kind: "image"; id: number; url: string; type: string; bytes: number; createdAt: string };

/** The job seeker's chats with this business (about any of its jobs). */
const theirChats = (seekerEmail: string, employerId: string) =>
  and(eq(t.conversations.seekerEmail, normalizeEmail(seekerEmail)), eq(t.conversations.employerId, employerId));

/** The newest PICKABLE_MESSAGES_MAX messages of the job seeker's chats with the business, oldest first. */
export async function listPickableMessages(seekerEmail: string, employerId: string): Promise<PickableMessage[]> {
  const db = await database();
  const rows = await db
    .select({ message: t.messages, jobTitle: t.jobs.titleZh })
    .from(t.messages)
    .innerJoin(t.conversations, eq(t.conversations.id, t.messages.conversationId))
    .innerJoin(t.jobs, eq(t.jobs.id, t.conversations.jobId))
    .where(theirChats(seekerEmail, employerId))
    .orderBy(desc(t.messages.id))
    .limit(PICKABLE_MESSAGES_MAX);
  return rows.reverse().map(({ message: m, jobTitle }) => ({
    id: m.id,
    mine: m.from === "seeker",
    byName: m.from === "employer" ? m.byName : null,
    text: m.text,
    sentAt: m.sentAt,
    jobTitle,
  }));
}

/** The messages with these ids that are in the job seeker's chats with the business, as a report keeps them. */
export async function findOwnMessages(
  seekerEmail: string,
  employerId: string,
  ids: readonly number[],
): Promise<EvidenceMessage[]> {
  if (!ids.length) return [];
  const db = await database();
  const rows = await db
    .select({ message: t.messages })
    .from(t.messages)
    .innerJoin(t.conversations, eq(t.conversations.id, t.messages.conversationId))
    .where(and(theirChats(seekerEmail, employerId), inArray(t.messages.id, [...ids])))
    .orderBy(asc(t.messages.id));
  return rows.map(({ message: m }) => ({
    messageId: m.id,
    from: m.from,
    byName: m.from === "employer" ? m.byName : null,
    text: m.text,
    sentAt: m.sentAt,
  }));
}

/** A report's evidence, the messages in the order they were sent. */
export async function listReportEvidence(reportId: string): Promise<ReportEvidence[]> {
  const db = await database();
  const rows = await db
    .select()
    .from(t.reportEvidence)
    .where(eq(t.reportEvidence.reportId, reportId))
    .orderBy(asc(t.reportEvidence.messageSentAt), asc(t.reportEvidence.id));
  return rows.flatMap((row): ReportEvidence[] => {
    if (row.kind === "message" && row.messageId !== null && row.messageFrom && row.messageSentAt)
      return [
        {
          kind: "message",
          messageId: row.messageId,
          from: row.messageFrom,
          byName: row.messageByName,
          text: row.messageText ?? "",
          sentAt: row.messageSentAt,
          createdAt: row.createdAt,
        },
      ];
    if (row.kind === "image" && row.imageKey && row.imageType)
      return [
        {
          kind: "image",
          id: row.id,
          url: `/api/report-evidence/${row.id}`,
          type: row.imageType,
          bytes: row.imageBytes ?? 0,
          createdAt: row.createdAt,
        },
      ];
    return [];
  });
}

/** One screenshot's row, for /api/report-evidence/[id]: its report, where the file is, its type. */
export async function findEvidenceImage(
  id: number,
): Promise<{ reportId: string; key: string; type: string } | undefined> {
  const db = await database();
  const [row] = await db
    .select()
    .from(t.reportEvidence)
    .where(and(eq(t.reportEvidence.id, id), eq(t.reportEvidence.kind, "image")));
  return row?.imageKey && row.imageType
    ? { reportId: row.reportId, key: row.imageKey, type: row.imageType }
    : undefined;
}

/** The evidence this account sent, for its export: which report, and the messages (screenshots by format and size). */
export async function listEvidenceOf(email: string) {
  const db = await database();
  const rows = await db
    .select()
    .from(t.reportEvidence)
    .where(eq(t.reportEvidence.reporterEmail, normalizeEmail(email)))
    .orderBy(asc(t.reportEvidence.id));
  return rows.map((row) => ({
    reportId: row.reportId,
    kind: row.kind,
    ...(row.kind === "message"
      ? { messageFrom: row.messageFrom, messageText: row.messageText, messageSentAt: row.messageSentAt }
      : { imageType: row.imageType, imageBytes: row.imageBytes }),
    createdAt: row.createdAt,
  }));
}

/**
 * Removes screenshots' files once their rows are gone. A file left behind (the store did not answer) has no row
 * pointing at it, so nobody can be shown it; it is reported in the server log.
 */
export async function removeImages(keys: readonly (string | null)[]): Promise<void> {
  const files = keys.filter((key): key is string => !!key);
  if (!files.length) return;
  await evidenceStore()
    .remove(files)
    .catch((error: unknown) => console.error("report evidence: files not removed", files, error));
}

/** The keys of the screenshots this account attached, for removing their files with the account. */
export async function imageKeysOf(email: string): Promise<string[]> {
  const db = await database();
  const rows = await db
    .select({ key: t.reportEvidence.imageKey })
    .from(t.reportEvidence)
    .where(and(eq(t.reportEvidence.reporterEmail, normalizeEmail(email)), eq(t.reportEvidence.kind, "image")));
  return rows.flatMap((row) => (row.key ? [row.key] : []));
}

let cleanedDay: string | undefined;

/**
 * Deletes the evidence of reports handled more than EVIDENCE_KEEP_DAYS ago, screenshots' files too, once per New
 * Zealand day (the first report of the day calls it). Returns how many pieces went.
 */
export async function purgeExpiredEvidence(now = new Date()): Promise<number> {
  const day = nzDay(now);
  if (cleanedDay === day) return 0;
  cleanedDay = day;
  const db = await database();
  const cutoff = new Date(now.getTime() - EVIDENCE_KEEP_DAYS * 86_400_000).toISOString();
  const handled = db
    .select({ id: t.reports.id })
    .from(t.reports)
    .where(and(ne(t.reports.status, "open"), isNotNull(t.reports.handledAt), lt(t.reports.handledAt, cutoff)));
  const gone = await db
    .delete(t.reportEvidence)
    .where(inArray(t.reportEvidence.reportId, handled))
    .returning({ key: t.reportEvidence.imageKey });
  await removeImages(gone.map((row) => row.key));
  return gone.length;
}

/** For tests: the next purgeExpiredEvidence call runs whatever the day. */
export function resetEvidenceCleanupForTests(): void {
  cleanedDay = undefined;
}
