"use server";
// Server Functions for the employer pages, so reads and writes hit the same data the job seekers'
// pages read. The account comes from the session cookie and the business from that account on the
// server (getAccountEmployer); nothing the browser sends says who is acting.
import { DEFAULT_COUNTRY } from "@/config/countries";
import { getCurrentSession } from "@/lib/auth";
import { cookies } from "next/headers";
import {
  missingFields,
  parsePost,
  restoreChat,
  type ChatState,
  type ParsedPost,
  type RequiredField,
} from "@/lib/ai-post";
import { checkJob, publishDecision, type Finding } from "@/lib/compliance";
import { claudeSend } from "@/lib/ai-post/model/client";
import { assistantKind, FAKE_COOKIE, postingModel, postingTurn, type AssistantKind } from "@/lib/ai-post/model";
import { jobDays, jobNumbers, type JobDay, type JobNumbers } from "@/db/job-stats";
import {
  createJob,
  getAccount,
  getAccountEmployer,
  getEmployer,
  getJob,
  listEmployers,
  listJobsByEmployer,
  updateJob,
} from "@/lib/data";
import type { Employer, Job } from "@/lib/types";
import { matchJobAlerts } from "@/db/job-alerts";
import { renewalCounts, renewJob, type RenewalCounts } from "@/db/job-renewals";
import {
  buildRegister,
  findInRegister,
  searchRegister,
  type RegisterEntry,
} from "@/components/employer/business-register";
import { hiresFromAnswer, type HiresAnswer } from "@/components/employer/hires";
import { canApplyFor, KIND_LABELS, parseApplication, type VerifyKind } from "@/components/employer/verification";
import { latestVerification, submitVerification, type VerificationRequest } from "@/db/verification-requests";
import {
  canClose,
  canEdit,
  effectiveStatus,
  refreshedDates,
  refreshState,
  renewState,
} from "@/components/employer/job-status";
import { teamCan } from "@/components/employer/team";
import { completeJob, editPatch, sanitizeDraft } from "@/components/employer/post-form";

/**
 * The signed-in account's business, or why it cannot act as one. Like requireEmployer() from
 * @/lib/auth, but returns the reason instead of throwing, and tells a banned business apart.
 */
async function postingEmployer(): Promise<Employer | "signed_out" | "no_identity" | "banned"> {
  const session = await getCurrentSession();
  if (!session) return "signed_out";
  const employer = await getAccountEmployer(session.email);
  if (employer) return employer;
  // getAccountEmployer hides banned businesses; tell that case apart for the message.
  const linked = (await getAccount(session.email))?.employerId;
  return linked && (await getEmployer(linked))?.bannedAt ? "banned" : "no_identity";
}

const IDENTITY_ERRORS = {
  signed_out: "请先登录。",
  no_identity: "需要先开通雇主身份。",
  banned: "账号已被停用，不能再修改职位。",
};

/** The account's jobs, newest first, whatever their status. None without an employer identity. */
export async function getMyJobs(): Promise<Job[]> {
  const employer = await postingEmployer();
  if (typeof employer === "string") return [];
  const jobs = await listJobsByEmployer(employer.id);
  return [...jobs].sort((a, b) => b.postedAt.localeCompare(a.postedAt));
}

/**
 * Each of the account's jobs' numbers (#55): page views (a browser once a day), job seekers who started a chat, and
 * contact views. Counts only, never who.
 */
export async function getMyJobNumbers(): Promise<Record<string, JobNumbers>> {
  const employer = await postingEmployer();
  if (typeof employer === "string") return {};
  return jobNumbers((await listJobsByEmployer(employer.id)).map((j) => j.id));
}

/** How often each of the account's jobs was renewed, and when last (#69). */
export async function getMyJobRenewals(): Promise<RenewalCounts> {
  const employer = await postingEmployer();
  if (typeof employer === "string") return {};
  return renewalCounts((await listJobsByEmployer(employer.id)).map((j) => j.id));
}

/** One of the account's jobs with its numbers for each of the last 14 New Zealand days; null for anyone else's. */
export async function getMyJobDays(jobId: string): Promise<{ job: Job; days: JobDay[] } | null> {
  const employer = await postingEmployer();
  if (typeof employer === "string" || typeof jobId !== "string") return null;
  const job = await getJob(jobId);
  if (!job || job.employerId !== employer.id) return null;
  return { job, days: await jobDays(job.id) };
}

/** Runs on the server so a real model call can replace the stub without exposing a key. */
export async function parseDraft(text: string): Promise<ParsedPost> {
  return parsePost(String(text).slice(0, 5000), DEFAULT_COUNTRY);
}

/** One turn of the posting chat. On the server for the same reason; the state from the browser is rebuilt first. */
export async function chatTurn(state: unknown, message: string): Promise<ChatState> {
  const employer = await postingEmployer();
  const restored = restoreChat(state, DEFAULT_COUNTRY, (d) => sanitizeDraft(d, DEFAULT_COUNTRY));
  // #102: Claude in production; the script (or the fake model) only outside it.
  const turn = await postingTurn(
    { ...restored, ...(typeof employer !== "string" && { employer: { verification: employer.verification } }) },
    String(message ?? ""),
    {
      kind: await chatAssistantKind(),
      model: postingModel(process.env),
      claude: claudeSend,
      sanitize: (d) => sanitizeDraft(d, DEFAULT_COUNTRY),
    },
  );
  return turn.state;
}

/** Which assistant the posting chat talks to, so the page can say when it is not the AI (#102). */
export async function chatAssistantKind(): Promise<AssistantKind> {
  const fake = (await cookies()).get(FAKE_COOKIE)?.value === "1";
  return assistantKind(process.env, fake);
}

export type PublishResult =
  | { ok: true; job: Job }
  | {
      ok: false;
      reason: "signed_out" | "no_identity" | "banned" | "not_ready";
      findings: Finding[];
      missing: RequiredField[];
    };

/** Checks the draft again on the server, then publishes it as active or pending review. */
export async function publishJob(input: unknown): Promise<PublishResult> {
  const draft = sanitizeDraft(input, DEFAULT_COUNTRY);
  const employer = await postingEmployer();
  const findings = checkJob(draft, DEFAULT_COUNTRY, typeof employer === "string" ? undefined : employer);
  const missing = missingFields(draft);
  if (typeof employer === "string") return { ok: false, reason: employer, findings, missing };

  const decision = publishDecision(findings);
  const job = decision.canPublish ? completeJob(draft, employer.id, Date.now(), decision.status) : undefined;
  if (!job) return { ok: false, reason: "not_ready", findings, missing };
  const created = await createJob(job);
  await matchJobAlerts(created); // live at once: tell job seekers whose alerts it matches (#53)
  return { ok: true, job: created };
}

// ---- managing published jobs (B6) ----

export type ChangeResult = { ok: true; job: Job } | { ok: false; error_zh: string; findings?: Finding[] };

/** The job, if it belongs to the account's business and that business may still post. */
async function ownJob(jobId: unknown): Promise<Job | string> {
  const employer = await postingEmployer();
  if (typeof employer === "string") return IDENTITY_ERRORS[employer];
  const job = await getJob(String(jobId));
  if (!job || job.employerId !== employer.id) return "找不到这个职位。";
  return job;
}

export async function getMyJob(jobId: string): Promise<Job | null> {
  const job = await ownJob(jobId);
  return typeof job === "string" ? null : job;
}

/** Ends a live or waiting job now. Refreshing reopens it. */
export async function closeMyJob(jobId: string, hires?: HiresAnswer | null): Promise<ChangeResult> {
  const job = await ownJob(jobId);
  if (typeof job === "string") return { ok: false, error_zh: job };
  const now = Date.now();
  if (!canClose(job, now)) return { ok: false, error_zh: "这个职位已经结束或已被下架。" };
  const answer = hiresFromAnswer(hires, now);
  if (!answer.ok) return answer;
  return {
    ok: true,
    job: (await updateJob(job.id, { status: "expired", expiresAt: new Date(now).toISOString(), ...answer.fields }))!,
  };
}

/** Records or corrects how many people an ended job hired. */
export async function confirmHires(jobId: string, hires: HiresAnswer): Promise<ChangeResult> {
  const job = await ownJob(jobId);
  if (typeof job === "string") return { ok: false, error_zh: job };
  if (effectiveStatus(job, Date.now()) !== "expired") return { ok: false, error_zh: "职位结束后才能记录招到几人。" };
  const answer = hiresFromAnswer(hires ?? {}, Date.now());
  if (!answer.ok) return answer;
  return { ok: true, job: (await updateJob(job.id, answer.fields))! };
}

/** Checks a job against today's rules (the minimum wage may have gone up since it was posted). */
async function recheck(job: Job): Promise<{ ok: true; status: Job["status"] } | ChangeResult> {
  const findings = checkJob(job, job.country, await getEmployer(job.employerId));
  const decision = publishDecision(findings);
  if (!decision.canPublish) return { ok: false, error_zh: "这个职位不符合现在的发布规则，请先编辑。", findings };
  return { ok: true, status: decision.status };
}

/** Back on top, with at least 30 days to run. Only a live job; it is checked again and stays live. */
export async function refreshMyJob(jobId: string): Promise<ChangeResult> {
  const job = await ownJob(jobId);
  if (typeof job === "string") return { ok: false, error_zh: job };
  const now = Date.now();
  const state = refreshState(job, now);
  if (!state.allowed) return { ok: false, error_zh: `不能刷新：${state.reason_zh}` };

  const checked = await recheck(job);
  if (!("status" in checked)) return checked;
  return { ok: true, job: (await updateJob(job.id, { ...refreshedDates(now, job.expiresAt), status: "active" }))! };
}

/**
 * Pushes the closing date back by 14, 30 or 60 days without moving the job up the list (#69): before it closes, or
 * up to 14 days after. It is checked against today's rules first; an ended job reopens, or waits for review when
 * the check says so. Each renewal is recorded. A banned business cannot renew (ownJob).
 */
export async function renewMyJob(jobId: string, days: number): Promise<ChangeResult> {
  const job = await ownJob(jobId);
  if (typeof job === "string") return { ok: false, error_zh: job };
  const now = Date.now();
  const state = renewState(job, now);
  if (!state.allowed) return { ok: false, error_zh: `不能续期：${state.reason_zh}` };
  const choice = state.choices.find((c) => c.days === days);
  if (!choice) return { ok: false, error_zh: "请选择续期 14、30 或 60 天。" };
  if (!choice.allowed) return { ok: false, error_zh: `续期 ${days} 天会超过最远的截止日，请选短一些的。` };

  const checked = await recheck(job);
  if (!("status" in checked)) return checked;
  const status = effectiveStatus(job, now) === "active" ? "active" : checked.status;
  const renewed = await renewJob(job.id, { expiresAt: choice.expiresAt, status, days }, new Date(now));
  return renewed ? { ok: true, job: renewed } : { ok: false, error_zh: "找不到这个职位。" };
}

/**
 * Saves an edited job after the same checks as publishing. A live job whose new text needs review
 * goes back to review; dates and the employer never change here.
 */
export async function editMyJob(jobId: string, input: unknown): Promise<ChangeResult> {
  const job = await ownJob(jobId);
  if (typeof job === "string") return { ok: false, error_zh: job };
  if (!canEdit(job)) return { ok: false, error_zh: "这个职位已被下架，不能修改。" };

  const draft = sanitizeDraft(input, job.country);
  const findings = checkJob(draft, job.country, await getEmployer(job.employerId));
  const decision = publishDecision(findings);
  const edited = decision.canPublish
    ? completeJob(draft, job.employerId, Date.parse(job.postedAt), job.status)
    : undefined;
  if (!edited) return { ok: false, error_zh: "还有问题没处理或必填项没填。", findings };

  const live = job.status === "active" || job.status === "pending_review";
  const status = live ? decision.status : job.status;
  return { ok: true, job: (await updateJob(job.id, { ...editPatch(edited), status }))! };
}

// ---- business verification (B7) ----

/** The account's business as it is now (verification and a ban can change after the page was built). */
export async function getMyEmployer(): Promise<Employer | null> {
  const session = await getCurrentSession();
  if (!session) return null;
  const linked = (await getAccount(session.email))?.employerId;
  return (linked && (await getEmployer(linked))) || null;
}

export async function lookupBusiness(query: string): Promise<{ results: RegisterEntry[]; error_zh?: string }> {
  return searchRegister(buildRegister(await listEmployers()), String(query).slice(0, 100));
}

// ---- 企业验证 by a person (#78, ADR 0011) ----

/** An application as its own business sees it: no email, neither the applicant's nor the moderator's. */
export type MyVerification = Omit<VerificationRequest, "submittedByEmail" | "decidedByEmail" | "checklist">;

function mine(request: VerificationRequest): MyVerification {
  const view: Partial<VerificationRequest> = { ...request };
  delete view.submittedByEmail;
  delete view.decidedByEmail;
  delete view.checklist;
  return view as MyVerification;
}

/** The business's latest 企业验证 application, if any (pending, approved, rejected or withdrawn). */
export async function getMyVerification(): Promise<MyVerification | null> {
  const employer = await postingEmployer();
  if (typeof employer === "string") return null;
  const latest = await latestVerification(employer.id);
  return latest ? mine(latest) : null;
}

export type VerifyResult = { ok: true; request: MyVerification } | { ok: false; error_zh: string };

const SUBMIT_ERRORS = {
  pending: "你已经有一份验证申请在审核中，审核员核对后会通知你。",
  nzbn_pending: "这个 NZBN 已经有一份验证申请在审核中。如果是你的公司，请联系我们。",
  nzbn_taken: "这个 NZBN 已经被其他店铺验证。如果是你的公司，请联系我们。",
};

/**
 * Applies for 已验证企业 or 认证雇主 with a register entry and the applicant's details. It waits for a moderator
 * (#78): nothing changes on the business until they approve. A banned business cannot apply.
 */
export async function requestVerification(input: unknown): Promise<VerifyResult> {
  const employer = await postingEmployer();
  if (employer === "banned") return { ok: false, error_zh: "账号已被停用，不能申请验证。" };
  if (typeof employer === "string") return { ok: false, error_zh: IDENTITY_ERRORS[employer] };
  const session = (await getCurrentSession())!;
  // Only an admin of the business's team applies (#87).
  if (!teamCan((await getAccount(session.email))?.teamRole, "verify"))
    return { ok: false, error_zh: "只有团队管理员能申请企业验证，请找你们店的管理员。" };

  const parsed = parseApplication(input);
  if (!parsed.ok) return parsed;
  const application = parsed.value;
  if (!canApplyFor(employer.verification, application.kind))
    return { ok: false, error_zh: `你的店铺已经是「${KIND_LABELS[employer.verification as VerifyKind]}」。` };
  const entry = findInRegister(buildRegister(await listEmployers()), application.nzbn);
  if (!entry) return { ok: false, error_zh: "企业登记里没有这个 NZBN。" };
  if (entry.status !== "registered") return { ok: false, error_zh: "这家公司在企业登记里已注销，不能用来验证。" };

  const result = await submitVerification(employer, session.email, { ...application, legalName: entry.legalName });
  return result.status === "submitted"
    ? { ok: true, request: mine(result.request) }
    : { ok: false, error_zh: SUBMIT_ERRORS[result.status] };
}
