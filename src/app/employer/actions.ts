"use server";
// Server Functions for the employer pages, so reads and writes hit the same in-memory data the
// job seekers' pages read. The caller sends the signed-in email; the business always comes from the
// account on the server (getAccountEmployer), never from the browser. Demo: as elsewhere, the server
// trusts the email it is sent; real authentication checks the session here instead.
import { DEFAULT_COUNTRY } from "@/config/countries";
import { missingFields, nextTurn, parsePost, restoreChat, type ChatState, type ParsedPost, type RequiredField } from "@/lib/ai-post";
import { checkJob, publishDecision, type Finding } from "@/lib/compliance";
import {
  createJob,
  getAccount,
  getAccountEmployer,
  getEmployer,
  getJob,
  listContactViews,
  listEmployers,
  listJobsByEmployer,
  setEmployerVerification,
  updateJob,
} from "@/lib/data";
import type { Employer, Job } from "@/lib/types";
import { buildRegister, normalizeNzbn, searchRegister, type RegisterEntry } from "@/components/employer/business-register";
import { hiresFromAnswer, type HiresAnswer } from "@/components/employer/hires";
import { canClose, canEdit, effectiveStatus, refreshedDates, refreshState } from "@/components/employer/job-status";
import { completeJob, editPatch, sanitizeDraft } from "@/components/employer/post-form";

/** The account's business, or why it cannot act as one. */
async function postingEmployer(email: unknown): Promise<Employer | "no_identity" | "banned"> {
  if (typeof email !== "string" || !email.trim()) return "no_identity";
  const employer = await getAccountEmployer(email);
  if (employer) return employer;
  // getAccountEmployer hides banned businesses; tell that case apart for the message.
  const linked = (await getAccount(email))?.employerId;
  return linked && (await getEmployer(linked))?.bannedAt ? "banned" : "no_identity";
}

const IDENTITY_ERRORS = {
  no_identity: "需要先开通雇主身份。",
  banned: "账号已被停用，不能再修改职位。",
};

/** The account's jobs, newest first, whatever their status. None without an employer identity. */
export async function getMyJobs(email: string): Promise<Job[]> {
  const employer = await postingEmployer(email);
  if (typeof employer === "string") return [];
  const jobs = await listJobsByEmployer(employer.id);
  return [...jobs].sort((a, b) => b.postedAt.localeCompare(a.postedAt));
}

/** How many signed-in seekers revealed each job's contact details. Counts only, never who. */
export async function getContactViewCounts(email: string): Promise<Record<string, number>> {
  const employer = await postingEmployer(email);
  if (typeof employer === "string") return {};
  const jobs = await listJobsByEmployer(employer.id);
  const counts = await Promise.all(jobs.map(async (j) => [j.id, (await listContactViews(j.id)).length] as const));
  return Object.fromEntries(counts);
}

/** Runs on the server so a real model call can replace the stub without exposing a key. */
export async function parseDraft(text: string): Promise<ParsedPost> {
  return parsePost(String(text).slice(0, 5000), DEFAULT_COUNTRY);
}

/** One turn of the posting chat. On the server for the same reason; the state from the browser is rebuilt first. */
export async function chatTurn(state: unknown, message: string): Promise<ChatState> {
  return nextTurn(restoreChat(state, DEFAULT_COUNTRY, (d) => sanitizeDraft(d, DEFAULT_COUNTRY)), String(message ?? ""));
}

export type PublishResult =
  | { ok: true; job: Job }
  | { ok: false; reason: "no_identity" | "banned" | "not_ready"; findings: Finding[]; missing: RequiredField[] };

/** Checks the draft again on the server, then publishes it as active or pending review. */
export async function publishJob(input: unknown, email: string): Promise<PublishResult> {
  const draft = sanitizeDraft(input, DEFAULT_COUNTRY);
  const findings = checkJob(draft, DEFAULT_COUNTRY);
  const missing = missingFields(draft);
  const employer = await postingEmployer(email);
  if (typeof employer === "string") return { ok: false, reason: employer, findings, missing };

  const decision = publishDecision(findings);
  const job = decision.canPublish ? completeJob(draft, employer.id, Date.now(), decision.status) : undefined;
  if (!job) return { ok: false, reason: "not_ready", findings, missing };
  return { ok: true, job: await createJob(job) };
}

// ---- managing published jobs (B6) ----

export type ChangeResult = { ok: true; job: Job } | { ok: false; error_zh: string; findings?: Finding[] };

/** The job, if it belongs to the account's business and that business may still post. */
async function ownJob(jobId: unknown, email: unknown): Promise<Job | string> {
  const employer = await postingEmployer(email);
  if (typeof employer === "string") return IDENTITY_ERRORS[employer];
  const job = await getJob(String(jobId));
  if (!job || job.employerId !== employer.id) return "找不到这个职位。";
  return job;
}

export async function getMyJob(jobId: string, email: string): Promise<Job | null> {
  const job = await ownJob(jobId, email);
  return typeof job === "string" ? null : job;
}

/** Ends a live or waiting job now. Refreshing reopens it. */
export async function closeMyJob(jobId: string, email: string, hires?: HiresAnswer | null): Promise<ChangeResult> {
  const job = await ownJob(jobId, email);
  if (typeof job === "string") return { ok: false, error_zh: job };
  const now = Date.now();
  if (!canClose(job, now)) return { ok: false, error_zh: "这个职位已经结束或已被下架。" };
  const answer = hiresFromAnswer(hires, now);
  if (!answer.ok) return answer;
  return { ok: true, job: (await updateJob(job.id, { status: "expired", expiresAt: new Date(now).toISOString(), ...answer.fields }))! };
}

/** Records or corrects how many people an ended job hired. */
export async function confirmHires(jobId: string, email: string, hires: HiresAnswer): Promise<ChangeResult> {
  const job = await ownJob(jobId, email);
  if (typeof job === "string") return { ok: false, error_zh: job };
  if (effectiveStatus(job, Date.now()) !== "expired") return { ok: false, error_zh: "职位结束后才能记录招到几人。" };
  const answer = hiresFromAnswer(hires ?? {}, Date.now());
  if (!answer.ok) return answer;
  return { ok: true, job: (await updateJob(job.id, answer.fields))! };
}

/** Back on top for 30 more days. An ended job is checked again and reopens, or waits for review. */
export async function refreshMyJob(jobId: string, email: string): Promise<ChangeResult> {
  const job = await ownJob(jobId, email);
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
export async function editMyJob(jobId: string, email: string, input: unknown): Promise<ChangeResult> {
  const job = await ownJob(jobId, email);
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

// ---- business verification (B7) ----

/** The account's business as it is now (verification and a ban can change after the page was built). */
export async function getMyEmployer(email: string): Promise<Employer | null> {
  if (typeof email !== "string") return null;
  const linked = (await getAccount(email))?.employerId;
  return (linked && (await getEmployer(linked))) || null;
}

export async function lookupBusiness(query: string): Promise<{ results: RegisterEntry[]; error_zh?: string }> {
  return searchRegister(buildRegister(await listEmployers()), String(query).slice(0, 100));
}

export type VerifyResult = { ok: true; employer: Employer } | { ok: false; error_zh: string };

/**
 * Links a register entry to the employer and shows 已验证企业. An accredited employer keeps its
 * higher badge. Demo: the real version must also prove the person speaks for the company.
 */
export async function verifyBusiness(email: string, nzbn: string): Promise<VerifyResult> {
  const employer = await postingEmployer(email);
  if (employer === "banned") return { ok: false, error_zh: "账号已被停用，不能验证。" };
  if (employer === "no_identity") return { ok: false, error_zh: IDENTITY_ERRORS.no_identity };

  const employers = await listEmployers();
  const number = normalizeNzbn(String(nzbn));
  const entry = buildRegister(employers).find((e) => e.nzbn === number);
  if (!entry) return { ok: false, error_zh: "企业登记里没有这个 NZBN。" };
  if (entry.status !== "registered") return { ok: false, error_zh: "这家公司在企业登记里已注销，不能用来验证。" };
  if (employers.some((e) => e.id !== employer.id && e.businessNumber === number)) {
    return { ok: false, error_zh: "这个 NZBN 已经被其他店铺验证。如果是你的公司，请联系我们。" };
  }

  const verification = employer.verification === "accredited_employer" ? "accredited_employer" : "business_verified";
  const updated = await setEmployerVerification(employer.id, verification, { legalName: entry.legalName, businessNumber: entry.nzbn });
  return { ok: true, employer: { ...updated! } };
}
