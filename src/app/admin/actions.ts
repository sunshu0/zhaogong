"use server";
// Server Functions for /admin. Each one first checks the ADMIN_ENABLED switch, then the signed-in session,
// then the moderator role (requireModerator, #50); anyone else is refused.
import { DEFAULT_COUNTRY } from "@/config/countries";
import { grantModerator, listModerators, revokeModerator, type Moderator } from "@/db/moderators";
import { checkJob, publishDecision, type Finding } from "@/lib/compliance";
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
import { describeAction, groupOpenReports } from "@/app/admin/moderation";
import { REFUSED_ZH, requireModerator } from "@/app/admin/moderator";
import { isValidEmail } from "@/components/seeker/session";

export interface QueueItem {
  job: Job;
  employer?: Employer;
  findings: Finding[];
}

export interface ModerationQueue {
  flagged: QueueItem[];
  reported: (QueueItem & { reports: Report[] })[];
  log: (ModerationLogEntry & { text: string })[];
}

/** Why the queue or the moderator list is not shown: not signed in, or not a moderator. */
export type Refused = { refused: "signed_out" | "not_moderator"; error_zh: string };

async function item(job: Job): Promise<QueueItem> {
  const employer = await getEmployer(job.employerId);
  return { job, employer, findings: checkJob(job, job.country, employer) };
}

/** The queue, for a moderator. */
export async function getModerationQueue(): Promise<ModerationQueue | Refused> {
  const me = await requireModerator();
  if (!me.ok) return { refused: me.reason, error_zh: REFUSED_ZH[me.reason] };
  const jobs = await listAllJobs(DEFAULT_COUNTRY);
  const flagged = await Promise.all(jobs.filter((j) => j.status === "pending_review").map(item));
  const groups = groupOpenReports(await listReports());
  const reported = (
    await Promise.all(
      groups.map(async (g) => {
        const job = await getJob(g.jobId);
        return job ? { ...(await item(job)), reports: g.reports } : undefined;
      }),
    )
  ).filter((r) => r != null);
  const log = (await listModerationLog()).map((e) => ({ ...e, text: describeAction(e) }));
  return { flagged, reported, log };
}

export type AdminResult = { ok: true; text: string } | { ok: false; error_zh: string };

/** The refusal as an AdminResult, or undefined for a moderator. */
async function refusal(): Promise<AdminResult | undefined> {
  const me = await requireModerator();
  return me.ok ? undefined : { ok: false, error_zh: REFUSED_ZH[me.reason] };
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

/** A job flagged at posting is fine: it goes live for 30 days from now. */
export async function approveJob(jobId: string): Promise<AdminResult> {
  const refused = await refusal();
  if (refused) return refused;
  const s = await subject(jobId);
  if (!s || s.job.status !== "pending_review") return { ok: false, error_zh: "这个职位不在待审核列表里。" };
  if (s.employer?.bannedAt) return { ok: false, error_zh: "雇主已被封禁，不能通过。" };
  const findings = checkJob(s.job, s.job.country, s.employer);
  if (!publishDecision(findings).canPublish) return { ok: false, error_zh: "这个职位仍有不能发布的问题，只能下架。" };
  await updateJob(s.job.id, { status: "active", ...refreshedDates(Date.now()) });
  const entry = await addModerationLog({ action: "approve", ...s.names, rules: findings.map((f) => f.rule) });
  return { ok: true, text: describeAction(entry) };
}

/** Takes a job down and closes its open reports as acted on. */
export async function takeDownJob(jobId: string): Promise<AdminResult> {
  const refused = await refusal();
  if (refused) return refused;
  const s = await subject(jobId);
  if (!s) return { ok: false, error_zh: "找不到这个职位。" };
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
  });
  return { ok: true, text: describeAction(entry) };
}

/** The reports on this job do not hold up; the job stays as it is. */
export async function dismissReports(jobId: string): Promise<AdminResult> {
  const refused = await refusal();
  if (refused) return refused;
  const s = await subject(jobId);
  if (!s) return { ok: false, error_zh: "找不到这个职位。" };
  const reports = await openReportsFor(s.job.id);
  if (!reports.length) return { ok: false, error_zh: "这个职位没有待处理的举报。" };
  await close(reports, "dismissed");
  const entry = await addModerationLog({ action: "dismiss", ...s.names, reasons: reports.map((r) => r.reason) });
  return { ok: true, text: describeAction(entry) };
}

/** Bans the employer behind a job: all their jobs come down and reports on them are closed. */
export async function banJobEmployer(jobId: string): Promise<AdminResult> {
  const refused = await refusal();
  if (refused) return refused;
  const s = await subject(jobId);
  if (!s?.employer) return { ok: false, error_zh: "找不到这个雇主。" };
  if (s.employer.bannedAt) return { ok: false, error_zh: "这个雇主已经被封禁。" };
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
  });
  return { ok: true, text: describeAction(entry) };
}

// ---- moderators (#50) ----

/** The moderators, oldest first, for a moderator. */
export async function getModerators(): Promise<{ me: string; moderators: Moderator[] } | Refused> {
  const me = await requireModerator();
  if (!me.ok) return { refused: me.reason, error_zh: REFUSED_ZH[me.reason] };
  return { me: me.email, moderators: await listModerators() };
}

/** Makes a signed-up account a moderator. */
export async function addModerator(email: string): Promise<AdminResult> {
  const me = await requireModerator();
  if (!me.ok) return { ok: false, error_zh: REFUSED_ZH[me.reason] };
  const address = String(email ?? "").trim();
  if (!isValidEmail(address)) return { ok: false, error_zh: "请输入正确的邮箱地址。" };
  const result = await grantModerator(address, me.email);
  if (result === "no_account") return { ok: false, error_zh: "这个邮箱还没有注册。请对方先用这个邮箱登录一次。" };
  if (result === "already") return { ok: false, error_zh: "这个账号已经是审核员。" };
  return { ok: true, text: `添加审核员 ${address.toLowerCase()}` };
}

/** Takes the role away from a moderator, never the last one. */
export async function removeModerator(email: string): Promise<AdminResult> {
  const me = await requireModerator();
  if (!me.ok) return { ok: false, error_zh: REFUSED_ZH[me.reason] };
  const address = String(email ?? "").trim();
  const result = await revokeModerator(address);
  if (result === "last") return { ok: false, error_zh: "至少要留一位审核员，不能移除最后一位。" };
  if (result === "not_moderator") return { ok: false, error_zh: "这个账号不是审核员。" };
  return { ok: true, text: `移除审核员 ${address.toLowerCase()}` };
}
