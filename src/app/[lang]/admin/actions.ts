"use server";
// Server Functions for /admin. Each one first checks the ADMIN_ENABLED switch, then the signed-in session,
// then the moderator role (requireModerator, #50); anyone else is refused.
import { DEFAULT_COUNTRY } from "@/config/countries";
import { matchJobAlerts } from "@/db/job-alerts";
import { countReportEvidence, purgeExpiredEvidence } from "@/db/report-evidence";
import { grantModerator, listModerators, revokeModerator, type Moderator } from "@/db/moderators";
import { checkJob, type Finding } from "@/lib/compliance";
import {
  addModerationLog,
  banEmployer,
  getEmployer,
  getJob,
  listAllJobs,
  listModerationLog,
  listReports,
  updateJob,
  updateReport,
} from "@/lib/data";
import type { Employer, Job, ModerationLogEntry, Report } from "@/lib/types";
import { refreshedDates } from "@/components/employer/job-status";
import { approveBlocker, describeAction, groupOpenReports } from "@/app/[lang]/admin/moderation";
import { refusedText, requireModerator } from "@/app/[lang]/admin/moderator";
import { pick } from "@/i18n/messages";
import { adminMessages } from "@/i18n/messages/admin";
import type { Lang } from "@/i18n/lang";
import { requestLang } from "@/i18n/server";
import { isValidEmail } from "@/components/seeker/session";

/** This module's answers to the moderator, in the language of the request. */
const words = async () => pick(adminMessages, await requestLang()).errors;

export interface QueueItem {
  /** Without its contact details (#336, ADR 0026): the queue never shows them, so they stay on the server. */
  job: Omit<Job, "contact">;
  employer?: Employer;
  findings: Finding[];
}

/** A report as the queue lists it: with how much evidence it carries (#353), never the evidence itself. */
export type ReportInQueue = Report & { evidence?: { messages: number; images: number } };

export interface ModerationQueue {
  flagged: QueueItem[];
  reported: (QueueItem & { reports: ReportInQueue[] })[];
  log: (ModerationLogEntry & { text: string })[];
}

/** Why the queue or the moderator list is not shown: not signed in, or not a moderator. */
export type Refused = { refused: "signed_out" | "not_moderator"; error_zh: string };

/** A job in the queue, with what the checks found, worded in the moderator's language. */
async function item(job: Job, lang: Lang): Promise<QueueItem> {
  const employer = await getEmployer(job.employerId);
  const { contact: _contact, ...shown } = job;
  void _contact;
  return { job: shown, employer, findings: checkJob(job, job.country, employer, lang) };
}

/** The queue, for a moderator. */
export async function getModerationQueue(): Promise<ModerationQueue | Refused> {
  const me = await requireModerator();
  if (!me.ok) return { refused: me.reason, error_zh: await refusedText(me.reason) };
  // Security review E: evidence 180 days past its report's handling also goes when nobody reports anything new.
  // Once a day; a failure is tried again next time and never stops the queue from showing.
  await purgeExpiredEvidence().catch((error: unknown) => console.error("report evidence: cleanup failed", error));
  const lang = await requestLang();
  const jobs = await listAllJobs(DEFAULT_COUNTRY);
  const flagged = await Promise.all(jobs.filter((j) => j.status === "pending_review").map((j) => item(j, lang)));
  const groups = groupOpenReports(await listReports());
  const evidence = await countReportEvidence(groups.flatMap((g) => g.reports.map((r) => r.id)));
  const reported = (
    await Promise.all(
      groups.map(async (g) => {
        const job = await getJob(g.jobId);
        const reports = g.reports.map((r) => (evidence[r.id] ? { ...r, evidence: evidence[r.id] } : r));
        return job ? { ...(await item(job, lang)), reports } : undefined;
      }),
    )
  ).filter((r) => r != null);
  const log = (await listModerationLog()).map((e) => ({ ...e, text: describeAction(e, lang) }));
  return { flagged, reported, log };
}

export type AdminResult = { ok: true; text: string } | { ok: false; error_zh: string };

/** The signed-in moderator, who goes into the log (#60), or the refusal as an AdminResult. */
async function acting(): Promise<{ email: string; refused?: never } | { refused: AdminResult }> {
  const me = await requireModerator();
  return me.ok ? { email: me.email } : { refused: { ok: false, error_zh: await refusedText(me.reason) } };
}

async function openReportsFor(jobId: string): Promise<Report[]> {
  return (await listReports()).filter((r) => r.jobId === jobId && r.status === "open");
}

async function close(reports: Report[], status: Report["status"]) {
  await Promise.all(reports.map((r) => updateReport(r.id, status)));
}

async function subject(jobId: unknown) {
  const job = await getJob(String(jobId));
  if (!job) return undefined;
  const employer = await getEmployer(job.employerId);
  return {
    job,
    employer,
    names: {
      jobId: job.id,
      jobTitle: job.titleZh,
      employerId: job.employerId,
      employerName: employer?.name ?? job.employerId,
    },
  };
}

/** A job flagged at posting is fine: it goes live for 30 days from now, or until the later date it was renewed to. */
export async function approveJob(jobId: string): Promise<AdminResult> {
  const me = await acting();
  if (me.refused) return me.refused;
  const s = await subject(jobId);
  if (!s || s.job.status !== "pending_review") return { ok: false, error_zh: (await words()).notPending };
  const findings = checkJob(s.job, s.job.country, s.employer);
  const blocker = approveBlocker(s.employer, findings);
  if (blocker) return { ok: false, error_zh: (await words())[blocker] };
  const approved = await updateJob(s.job.id, { status: "active", ...refreshedDates(Date.now(), s.job.expiresAt) });
  if (approved) await matchJobAlerts(approved); // now live: tell job seekers whose alerts it matches (#53)
  const entry = await addModerationLog({
    action: "approve",
    ...s.names,
    rules: findings.map((f) => f.rule),
    moderator: me.email,
  });
  return { ok: true, text: describeAction(entry, await requestLang()) };
}

/** Takes a job down and closes its open reports as acted on. */
export async function takeDownJob(jobId: string): Promise<AdminResult> {
  const me = await acting();
  if (me.refused) return me.refused;
  const s = await subject(jobId);
  if (!s) return { ok: false, error_zh: (await words()).noJob };
  const reports = await openReportsFor(s.job.id);
  if (s.job.status !== "removed") await updateJob(s.job.id, { status: "removed" });
  await close(reports, "actioned");
  const rules =
    s.job.status === "pending_review" ? checkJob(s.job, s.job.country, s.employer).map((f) => f.rule) : undefined;
  const entry = await addModerationLog({
    action: "take_down",
    ...s.names,
    reasons: reports.map((r) => r.reason),
    rules,
    moderator: me.email,
  });
  return { ok: true, text: describeAction(entry, await requestLang()) };
}

/** The reports on this job do not hold up; the job stays as it is. */
export async function dismissReports(jobId: string): Promise<AdminResult> {
  const me = await acting();
  if (me.refused) return me.refused;
  const s = await subject(jobId);
  if (!s) return { ok: false, error_zh: (await words()).noJob };
  const reports = await openReportsFor(s.job.id);
  if (!reports.length) return { ok: false, error_zh: (await words()).noReports };
  await close(reports, "dismissed");
  const entry = await addModerationLog({
    action: "dismiss",
    ...s.names,
    reasons: reports.map((r) => r.reason),
    moderator: me.email,
  });
  return { ok: true, text: describeAction(entry, await requestLang()) };
}

/** Bans the employer behind a job: all their jobs come down and reports on them are closed. */
export async function banJobEmployer(jobId: string): Promise<AdminResult> {
  const me = await acting();
  if (me.refused) return me.refused;
  const s = await subject(jobId);
  if (!s?.employer) return { ok: false, error_zh: (await words()).noEmployer };
  if (s.employer.bannedAt) return { ok: false, error_zh: (await words()).alreadyBanned };
  const takenDown = await banEmployer(s.employer.id);
  const reports = (await listReports()).filter(
    (r) => r.status === "open" && (takenDown.includes(r.jobId) || r.jobId === s.job.id),
  );
  await close(reports, "actioned");
  const entry = await addModerationLog({
    action: "ban",
    employerId: s.employer.id,
    employerName: s.employer.name,
    takenDown: takenDown.length,
    moderator: me.email,
  });
  return { ok: true, text: describeAction(entry, await requestLang()) };
}

// ---- moderators (#50) ----

/** The moderators, oldest first, for a moderator. */
export async function getModerators(): Promise<{ me: string; moderators: Moderator[] } | Refused> {
  const me = await requireModerator();
  if (!me.ok) return { refused: me.reason, error_zh: await refusedText(me.reason) };
  return { me: me.email, moderators: await listModerators() };
}

/** Makes a signed-up account a moderator. */
export async function addModerator(email: string): Promise<AdminResult> {
  const me = await requireModerator();
  if (!me.ok) return { ok: false, error_zh: await refusedText(me.reason) };
  const address = String(email ?? "").trim();
  if (!isValidEmail(address)) return { ok: false, error_zh: (await words()).invalidEmail };
  const result = await grantModerator(address, me.email);
  if (result === "no_account") return { ok: false, error_zh: (await words()).noAccount };
  if (result === "already") return { ok: false, error_zh: (await words()).alreadyModerator };
  return { ok: true, text: pick(adminMessages, await requestLang()).added(address.toLowerCase()) };
}

/** Takes the role away from a moderator, never the last one. */
export async function removeModerator(email: string): Promise<AdminResult> {
  const me = await requireModerator();
  if (!me.ok) return { ok: false, error_zh: await refusedText(me.reason) };
  const address = String(email ?? "").trim();
  const result = await revokeModerator(address);
  if (result === "last") return { ok: false, error_zh: (await words()).lastModerator };
  if (result === "not_moderator") return { ok: false, error_zh: (await words()).notModerator };
  return { ok: true, text: pick(adminMessages, await requestLang()).removed(address.toLowerCase()) };
}
