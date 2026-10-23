"use server";

import { getCurrentSession } from "@/lib/auth";
import { cookies, headers } from "next/headers";
import { clientIp } from "@/lib/auth/limits";
import { isModerator } from "@/db/moderators";
import {
  getJob,
  hasOpenReport,
  isOpenReportClash,
  listContactViews,
  recordContactView,
  submitReport,
} from "@/lib/data";
import { reporterKey, takeReportCounts, type Reporter } from "@/lib/report-limits";
import { VISITOR_COOKIE, isVisitorId } from "@/lib/visitor";
import type { Job } from "@/lib/types";
import { isExpired, isPublic } from "@/components/seeker/job-facts";
import { formatPay } from "@/components/seeker/format";
import { parseReport } from "@/components/seeker/report";
import { pick } from "@/i18n/messages";
import { seekerJobsMessages } from "@/i18n/messages/seeker-jobs";
import { requestLang } from "@/i18n/server";
import { randomUUID } from "node:crypto";
import { evidenceStore } from "@/db/evidence-store";
import { findOwnMessages, listPickableMessages, purgeExpiredEvidence, removeImages } from "@/db/report-evidence";
import { sniffImage, stripMetadata } from "@/lib/image-metadata";
import {
  EVIDENCE_IMAGE_BYTES_MAX,
  EVIDENCE_IMAGES_MAX,
  parseEvidenceIds,
  type EvidenceImage,
  type PickableMessage,
} from "@/lib/report-evidence";

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
 * Sends a report on a job seekers can see. Anyone can report; signing in is not needed, except to attach evidence
 * (ADR 0027): `messageIds` must be messages of this browser's account's own chats with the job's business, at most
 * EVIDENCE_MESSAGES_MAX, copied into the report as they are now; `images` holds up to EVIDENCE_IMAGES_MAX files
 * under "image", JPEG, PNG or WebP by their bytes, each at most EVIDENCE_IMAGE_BYTES_MAX, kept without their metadata.
 * How often (security review C, ADR 0034): one open report per person and job, answered with 「已经举报过」, and a
 * daily count per account, visitor and network (report-limits.ts), answered with 「今天…到上限」. Moderators are not
 * counted.
 */
export async function reportJob(
  jobId: string,
  reason: string,
  note?: string,
  messageIds?: number[],
  images?: FormData,
): Promise<ReportResult> {
  const lang = await requestLang();
  const t = pick(seekerJobsMessages, lang).report;
  const parsed = parseReport({ reason, note }, lang);
  if (!parsed.ok) return parsed;
  const ids = parseEvidenceIds(messageIds);
  if (!ids) return { ok: false, error: t.evidence.notYours };
  const job = typeof jobId === "string" ? await getJob(jobId) : undefined;
  if (!job || !isPublic(job)) return { ok: false, error: t.jobGone };
  const files = images instanceof FormData ? images.getAll("image") : [];
  if (files.length > EVIDENCE_IMAGES_MAX || !files.every((file) => file instanceof File))
    return { ok: false, error: t.evidence.tooManyImages(EVIDENCE_IMAGES_MAX) };
  const session = await getCurrentSession();
  const visitor = (await cookies()).get(VISITOR_COOKIE)?.value;
  const reporter: Reporter = session ? { account: session.email } : isVisitorId(visitor) ? { visitor } : undefined;
  const key = reporterKey(reporter);
  if (key && (await hasOpenReport(job.id, key))) return { ok: false, error: t.already };
  let evidence: Parameters<typeof submitReport>[3];
  let stored: EvidenceImage[] = [];
  const cleaned: { bytes: Uint8Array; type: EvidenceImage["type"] }[] = [];
  if (ids.length || files.length) {
    if (!session) return { ok: false, error: t.evidence.signedOut };
    const messages = await findOwnMessages(session.email, job.employerId, ids);
    if (messages.length !== ids.length) return { ok: false, error: t.evidence.notYours };
    for (const file of files as File[]) {
      if (file.size > EVIDENCE_IMAGE_BYTES_MAX)
        return { ok: false, error: t.evidence.imageTooBig(EVIDENCE_IMAGE_BYTES_MAX / 1024 / 1024) };
      const bytes = new Uint8Array(await file.arrayBuffer());
      const type = sniffImage(bytes);
      const clean = type && stripMetadata(bytes, type);
      if (!type || !clean) return { ok: false, error: t.evidence.notImage };
      cleaned.push({ bytes: clean, type });
    }
    evidence = { reporterEmail: session.email, messages, images: [] };
  }
  // Counted once the report is known to be valid, before anything is stored.
  if (!(session && (await isModerator(session.email)))) {
    const ip = clientIp((await headers()).get("cf-connecting-ip"));
    if (await takeReportCounts(reporter, ip, cleaned.length))
      return { ok: false, error: session ? t.limited : t.limitedSignedOut };
  }
  if (evidence) {
    const store = evidenceStore();
    stored = cleaned.map(({ bytes, type }) => ({ key: randomUUID(), type, bytes: bytes.length }));
    await Promise.all(stored.map((image, i) => store.put(image.key, cleaned[i].bytes, image.type))).catch(
      async (error: unknown) => {
        await removeImages(stored.map((image) => image.key));
        throw error;
      },
    );
    evidence = { ...evidence, images: stored };
  }
  let report: Awaited<ReturnType<typeof submitReport>>;
  try {
    report = await submitReport(job.id, parsed.reason, parsed.note, evidence, key);
  } catch (error) {
    // The files have no row to point at them: take them back.
    await removeImages(stored.map((image) => image.key));
    // The same person's other report on this job got in first (sent twice at once): theirs stands.
    if (isOpenReportClash(error)) return { ok: false, error: t.already };
    throw error;
  }
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
