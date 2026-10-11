"use server";
// Server Functions for the employer pages, so reads and writes hit the same in-memory data the
// job seekers' pages read. Demo only: there is no real session, so the caller says who it is.
// The backend must check the signed-in employer here before trusting employerId.
import { DEFAULT_COUNTRY } from "@/config/countries";
import { parsePost, missingFields, type ParsedPost, type RequiredField } from "@/lib/ai-post";
import { checkJob, publishDecision, type Finding } from "@/lib/compliance";
import { createJob, getEmployer, getJob, listContactViews, listJobsByEmployer, updateJob } from "@/lib/data";
import type { Employer, Job } from "@/lib/types";
import { canClose, canEdit, effectiveStatus, refreshedDates, refreshState } from "@/components/employer/job-status";
import { completeJob, editPatch, sanitizeDraft } from "@/components/employer/post-form";

/** Every job of one employer, newest first, whatever its status. */
export async function getMyJobs(employerId: string): Promise<Job[]> {
  const jobs = await listJobsByEmployer(String(employerId));
  return [...jobs].sort((a, b) => b.postedAt.localeCompare(a.postedAt));
}

/** How many signed-in seekers revealed each job's contact details. Counts only, never who. */
export async function getContactViewCounts(employerId: string): Promise<Record<string, number>> {
  const jobs = await listJobsByEmployer(String(employerId));
  const counts = await Promise.all(jobs.map(async (j) => [j.id, (await listContactViews(j.id)).length] as const));
  return Object.fromEntries(counts);
}

/** Runs on the server so a real model call can replace the stub without exposing a key. */
export async function parseDraft(text: string): Promise<ParsedPost> {
  return parsePost(String(text).slice(0, 5000), DEFAULT_COUNTRY);
}

export type PublishResult =
  | { ok: true; job: Job }
  | { ok: false; reason: "unknown_employer" | "banned" | "not_ready"; findings: Finding[]; missing: RequiredField[] };

async function postingEmployer(employerId: unknown): Promise<Employer | "unknown_employer" | "banned"> {
  const employer = await getEmployer(String(employerId));
  if (!employer) return "unknown_employer";
  return employer.bannedAt ? "banned" : employer;
}

/** Checks the draft again on the server, then publishes it as active or pending review. */
export async function publishJob(input: unknown, employerId: string): Promise<PublishResult> {
  const draft = sanitizeDraft(input, DEFAULT_COUNTRY);
  const findings = checkJob(draft, DEFAULT_COUNTRY);
  const missing = missingFields(draft);
  const employer = await postingEmployer(employerId);
  if (typeof employer === "string") return { ok: false, reason: employer, findings, missing };

  const decision = publishDecision(findings);
  const job = decision.canPublish ? completeJob(draft, employer.id, Date.now(), decision.status) : undefined;
  if (!job) return { ok: false, reason: "not_ready", findings, missing };
  return { ok: true, job: await createJob(job) };
}

// ---- managing published jobs (B6) ----

export type ChangeResult = { ok: true; job: Job } | { ok: false; error_zh: string; findings?: Finding[] };

/** The job, if it belongs to this employer and the employer may still post. */
async function ownJob(jobId: unknown, employerId: unknown): Promise<Job | string> {
  const employer = await postingEmployer(employerId);
  if (employer === "banned") return "账号已被停用，不能再修改职位。";
  if (employer === "unknown_employer") return "找不到这个雇主账号，请重新登录。";
  const job = await getJob(String(jobId));
  if (!job || job.employerId !== employer.id) return "找不到这个职位。";
  return job;
}

export async function getMyJob(jobId: string, employerId: string): Promise<Job | null> {
  const job = await ownJob(jobId, employerId);
  return typeof job === "string" ? null : job;
}

/** Ends a live or waiting job now. Refreshing reopens it. */
export async function closeMyJob(jobId: string, employerId: string): Promise<ChangeResult> {
  const job = await ownJob(jobId, employerId);
  if (typeof job === "string") return { ok: false, error_zh: job };
  const now = Date.now();
  if (!canClose(job, now)) return { ok: false, error_zh: "这个职位已经结束或已被下架。" };
  return { ok: true, job: (await updateJob(job.id, { status: "expired", expiresAt: new Date(now).toISOString() }))! };
}

/** Back on top for 30 more days. An ended job is checked again and reopens, or waits for review. */
export async function refreshMyJob(jobId: string, employerId: string): Promise<ChangeResult> {
  const job = await ownJob(jobId, employerId);
  if (typeof job === "string") return { ok: false, error_zh: job };
  const now = Date.now();
  const state = refreshState(job, now);
  if (!state.allowed) return { ok: false, error_zh: `不能刷新：${state.reason_zh}` };

  const findings = checkJob(job, job.country);
  const decision = publishDecision(findings);
  if (!decision.canPublish) return { ok: false, error_zh: "这个职位不符合现在的发布规则，请先编辑。", findings };
  const status = effectiveStatus(job, now) === "active" ? "active" : decision.status;
  return { ok: true, job: (await updateJob(job.id, { ...refreshedDates(now), status }))! };
}

/**
 * Saves an edited job after the same checks as publishing. A live job whose new text needs review
 * goes back to review; dates and the employer never change here.
 */
export async function editMyJob(jobId: string, employerId: string, input: unknown): Promise<ChangeResult> {
  const job = await ownJob(jobId, employerId);
  if (typeof job === "string") return { ok: false, error_zh: job };
  if (!canEdit(job)) return { ok: false, error_zh: "这个职位已被下架，不能修改。" };

  const draft = sanitizeDraft(input, job.country);
  const findings = checkJob(draft, job.country);
  const decision = publishDecision(findings);
  const edited = decision.canPublish ? completeJob(draft, job.employerId, Date.parse(job.postedAt), job.status) : undefined;
  if (!edited) return { ok: false, error_zh: "还有问题没处理或必填项没填。", findings };

  const live = job.status === "active" || job.status === "pending_review";
  const status = live ? decision.status : job.status;
  return { ok: true, job: (await updateJob(job.id, { ...editPatch(edited), status }))! };
}
