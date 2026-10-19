"use server";

import { getCurrentSession } from "@/lib/auth";
import { getJob, listContactViews, recordContactView, submitReport } from "@/lib/data";
import type { Job } from "@/lib/types";
import { isExpired, isPublic } from "@/components/seeker/job-facts";
import { formatPay } from "@/components/seeker/format";
import { parseReport } from "@/components/seeker/report";
import { pick } from "@/i18n/messages";
import { seekerJobsMessages } from "@/i18n/messages/seeker-jobs";
import { requestLang } from "@/i18n/server";
import { findOwnMessages, listPickableMessages, purgeExpiredEvidence } from "@/db/report-evidence";
import { parseEvidenceIds, type PickableMessage } from "@/lib/report-evidence";

/** The job page fetches contact details on every visit, so one person counts once per job in this window. */
const RECORD_AGAIN_AFTER_MS = 30 * 60 * 1000;

/**
 * A job's contact details, fetched after sign-in so they are not in the page HTML for everyone, and recorded with
 * recordContactView so the employer side can see who looked. The viewer is the account of this browser's server
 * session (the cookie), never an email the page sends. Only for jobs whose employer made the details public
 * (contactPublic); otherwise they are exchanged in the chat, and this returns nothing.
 */
export async function revealContact(jobId: string): Promise<Job["contact"] | null> {
  if (typeof jobId !== "string") return null;
  const session = await getCurrentSession();
  if (!session) return null;
  const viewer = session.email;
  const job = await getJob(jobId);
  if (!job || !isPublic(job) || !job.contactPublic) return null;

  const last = (await listContactViews(job.id)).find((v) => v.viewerEmail === viewer);
  if (!last || Date.now() - Date.parse(last.viewedAt) >= RECORD_AGAIN_AFTER_MS) await recordContactView(job.id, viewer);

  const { phone, wechat, email: contactEmail } = job.contact;
  return { phone, wechat, email: contactEmail };
}

export type ReportResult = { ok: true; reportId: string } | { ok: false; error: string };

/**
 * Sends a report on a job seekers can see. Anyone can report; signing in is not needed, except to attach chat
 * messages (ADR 0027): `messageIds` must be messages of this browser's account's own chats with the job's business,
 * at most EVIDENCE_MESSAGES_MAX; they are copied into the report as they are now.
 */
export async function reportJob(
  jobId: string,
  reason: string,
  note?: string,
  messageIds?: number[],
): Promise<ReportResult> {
  const lang = await requestLang();
  const t = pick(seekerJobsMessages, lang).report;
  const parsed = parseReport({ reason, note }, lang);
  if (!parsed.ok) return parsed;
  const ids = parseEvidenceIds(messageIds);
  if (!ids) return { ok: false, error: t.evidence.notYours };
  const job = typeof jobId === "string" ? await getJob(jobId) : undefined;
  if (!job || !isPublic(job)) return { ok: false, error: t.jobGone };
  let evidence: Parameters<typeof submitReport>[3];
  if (ids.length) {
    const session = await getCurrentSession();
    if (!session) return { ok: false, error: t.evidence.signedOut };
    const messages = await findOwnMessages(session.email, job.employerId, ids);
    if (messages.length !== ids.length) return { ok: false, error: t.evidence.notYours };
    evidence = { reporterEmail: session.email, messages };
  }
  const report = await submitReport(job.id, parsed.reason, parsed.note, evidence);
  // The report is in; clearing old evidence failing is for the next report of the day to try.
  await purgeExpiredEvidence().catch(() => 0);
  return { ok: true, reportId: report.id };
}

/**
 * The messages the report form lists to attach (ADR 0027): this browser's account's chats with the job's business,
 * the newest PICKABLE_MESSAGES_MAX, oldest first. Null when signed out.
 */
export async function reportableMessages(jobId: string): Promise<PickableMessage[] | null> {
  const session = await getCurrentSession();
  if (!session) return null;
  const job = typeof jobId === "string" ? await getJob(jobId) : undefined;
  if (!job || !isPublic(job)) return [];
  return listPickableMessages(session.email, job.employerId);
}

export type JobSummary = { id: string; title: string; pay: string; open: boolean };

/** The job a chat is about, for the strip above the conversation: title, pay, and whether it still recruits. */
export async function jobSummary(jobId: string): Promise<JobSummary | null> {
  if (typeof jobId !== "string") return null;
  const job = await getJob(jobId);
  if (!job || !isPublic(job)) return null;
  return {
    id: job.id,
    title: job.titleZh,
    pay: formatPay(job.pay, job.country, await requestLang()),
    open: job.status === "active" && !isExpired(job, Date.now()),
  };
}
