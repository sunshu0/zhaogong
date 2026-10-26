"use server";
// Server Functions for /admin. Each one first checks the ADMIN_ENABLED switch, then the signed-in session,
// then the moderator role (requireModerator, #50); anyone else is refused.
import { BAN_REASON_MAX, currentBan, isPermanentBan, isTempBanDays } from "@/lib/employer-ban";
import { DEFAULT_COUNTRY } from "@/config/countries";
import { matchJobAlerts } from "@/db/job-alerts";
import { countReportEvidence, purgeExpiredEvidence } from "@/db/report-evidence";
import { isAdmin } from "@/db/admins";
import {
  grantModerator,
  listAdmins,
  listModeratorChanges,
  listModerators,
  revokeModerator,
  type Moderator,
  type ModeratorChange,
} from "@/db/moderators";
import { checkJob, type Finding } from "@/lib/compliance";
import {
  addModerationLog,
  banEmployer,
  getEmployer,
  getJob,
  listAllJobs,
  listModerationLog,
  listReports,
  listTempBannedEmployers,
  liftTempBan,
  makeBanPermanent,
  tempBanEmployer,
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

/**
 * Why the queue or the moderator list is not shown: not signed in, or not a moderator; for the record of moderator
 * changes also not an admin (ADR 0043).
 */
export type Refused = { refused: "signed_out" | "not_moderator" | "not_admin"; error_zh: string };

/** A job in the queue, with what the checks found, worded in the moderator's language. */
async function item(job: Job, lang: Lang): Promise<QueueItem> {
  const employer = currentBan(await getEmployer(job.employerId), Date.now());
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
  const employer = currentBan(await getEmployer(job.employerId), Date.now());
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
  if (isPermanentBan(s.employer)) return { ok: false, error_zh: (await words()).alreadyBanned };
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

/**
 * Bans the employer behind a reported job for 3, 7 or 30 days (ADR 0044), with a reason their team will see. Nothing
 * is taken down: their jobs are hidden until the ban is over. The reports on this job are closed; to take the job
 * down as well, 下架职位 is its own step.
 */
export async function tempBanJobEmployer(jobId: string, days: unknown, reason: unknown): Promise<AdminResult> {
  const me = await acting();
  if (me.refused) return me.refused;
  const t = await words();
  if (!isTempBanDays(days)) return { ok: false, error_zh: t.banDays };
  const why = typeof reason === "string" ? reason.trim() : "";
  if (!why) return { ok: false, error_zh: t.banReasonMissing };
  if (why.length > BAN_REASON_MAX) return { ok: false, error_zh: t.banReasonTooLong(BAN_REASON_MAX) };
  const s = await subject(jobId);
  if (!s?.employer) return { ok: false, error_zh: t.noEmployer };
  const banned = await tempBanEmployer(s.employer.id, days, why);
  if (!banned) return { ok: false, error_zh: t.alreadyBanned };
  const reports = (await listReports()).filter((r) => r.status === "open" && r.jobId === s.job.id);
  await close(reports, "actioned");
  const entry = await addModerationLog({
    action: "temp_ban",
    employerId: s.employer.id,
    employerName: s.employer.name,
    banDays: days,
    note: why,
    moderator: me.email,
  });
  return { ok: true, text: describeAction(entry, await requestLang()) };
}

/** A business under a temporary ban, for 记录与统计 (ADR 0044): until when, why, and who banned it. */
export interface TempBan {
  employerId: string;
  employerName: string;
  until: string;
  reason: string;
  by?: string;
}

/** The temporary bans running now, soonest end first, for a moderator. */
export async function getTempBans(): Promise<TempBan[] | Refused> {
  const me = await requireModerator();
  if (!me.ok) return { refused: me.reason, error_zh: await refusedText(me.reason) };
  const [banned, log] = await Promise.all([listTempBannedEmployers(Date.now()), listModerationLog()]);
  return banned.map((e) => ({
    employerId: e.id,
    employerName: e.name,
    until: e.bannedUntil!,
    reason: e.banReason ?? "",
    by: log.find((l) => l.action === "temp_ban" && l.employerId === e.id)?.moderator,
  }));
}

/** Ends a temporary ban now (ADR 0044); permanent bans are not lifted here. */
export async function liftEmployerTempBan(employerId: string): Promise<AdminResult> {
  const me = await acting();
  if (me.refused) return me.refused;
  const employer = await getEmployer(String(employerId));
  if (!employer || !(await liftTempBan(employer.id))) return { ok: false, error_zh: (await words()).notTempBanned };
  const entry = await addModerationLog({
    action: "unban",
    employerId: employer.id,
    employerName: employer.name,
    moderator: me.email,
  });
  return { ok: true, text: describeAction(entry, await requestLang()) };
}

/** Turns a temporary ban into a permanent one (ADR 0044): their live jobs come down, as with 封禁雇主. */
export async function makeEmployerBanPermanent(employerId: string): Promise<AdminResult> {
  const me = await acting();
  if (me.refused) return me.refused;
  const employer = await getEmployer(String(employerId));
  const takenDown = employer && (await makeBanPermanent(employer.id));
  if (!employer || !takenDown) return { ok: false, error_zh: (await words()).notTempBanned };
  const reports = (await listReports()).filter((r) => r.status === "open" && takenDown.includes(r.jobId));
  await close(reports, "actioned");
  const entry = await addModerationLog({
    action: "make_permanent",
    employerId: employer.id,
    employerName: employer.name,
    takenDown: takenDown.length,
    moderator: me.email,
  });
  return { ok: true, text: describeAction(entry, await requestLang()) };
}

// ---- moderators (#50) ----

/**
 * The admins (from the server's configuration, ADR 0043) and the moderators, oldest first, for a moderator; `admin`
 * says whether the one asking is an admin, who alone may add and remove moderators.
 */
export async function getModerators(): Promise<
  { me: string; admin: boolean; admins: string[]; moderators: Moderator[] } | Refused
> {
  const me = await requireModerator();
  if (!me.ok) return { refused: me.reason, error_zh: await refusedText(me.reason) };
  const admins = listAdmins();
  return {
    me: me.email,
    admin: isAdmin(me.email),
    admins,
    // An admin also listed as a moderator shows once, as an admin.
    moderators: (await listModerators()).filter((m) => !admins.includes(m.email)),
  };
}

/** The signed-in admin, or the refusal: a moderator who is not an admin may only look (ADR 0043). */
async function actingAdmin(): Promise<{ email: string; refused?: never } | { refused: AdminResult }> {
  const me = await requireModerator();
  if (!me.ok) return { refused: { ok: false, error_zh: await refusedText(me.reason) } };
  if (!isAdmin(me.email)) return { refused: { ok: false, error_zh: (await words()).adminOnly } };
  return { email: me.email };
}

/** Makes a signed-up account with no job seeker's or employer's data a moderator; admins only. */
export async function addModerator(email: string): Promise<AdminResult> {
  const me = await actingAdmin();
  if (me.refused) return me.refused;
  const address = String(email ?? "").trim();
  if (!isValidEmail(address)) return { ok: false, error_zh: (await words()).invalidEmail };
  const result = await grantModerator(address, me.email);
  if (result === "no_account") return { ok: false, error_zh: (await words()).noAccount };
  if (result === "has_data") return { ok: false, error_zh: (await words()).hasData };
  if (result === "already") return { ok: false, error_zh: (await words()).alreadyModerator };
  return { ok: true, text: pick(adminMessages, await requestLang()).added(address.toLowerCase()) };
}

/** Takes the role away from a moderator; admins only, and never from an admin. */
export async function removeModerator(email: string): Promise<AdminResult> {
  const me = await actingAdmin();
  if (me.refused) return me.refused;
  const address = String(email ?? "").trim();
  const result = await revokeModerator(address, me.email);
  if (result === "admin") return { ok: false, error_zh: (await words()).isAdmin };
  if (result === "not_moderator") return { ok: false, error_zh: (await words()).notModerator };
  return { ok: true, text: pick(adminMessages, await requestLang()).removed(address.toLowerCase()) };
}

/** Who added and removed moderators, newest first; for admins only (ADR 0043). */
export async function getModeratorChanges(): Promise<{ changes: ModeratorChange[] } | Refused> {
  const me = await requireModerator();
  if (!me.ok) return { refused: me.reason, error_zh: await refusedText(me.reason) };
  if (!isAdmin(me.email)) return { refused: "not_admin", error_zh: (await words()).adminOnly };
  return { changes: await listModeratorChanges() };
}
