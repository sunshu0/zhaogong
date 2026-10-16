"use server";

// 外部职位 for /admin (#112, ADR 0014): imported jobs wait here until a moderator shows or hides them (先审后显示),
// and a company can be stopped, resumed, or removed at its own request. A moderator only (requireModerator, as every
// /admin Server Function); every decision goes into the moderation log with who made it (#60).
import { EXTERNAL_COMPANIES, importAllowed, type TermsCheck } from "@/config/external-companies";
import {
  blockCompany,
  getExternalJob,
  listCompanyBlocks,
  listExternalJobs,
  setExternalReview,
  unblockCompany,
  type CompanyBlock,
  type ExternalJob,
} from "@/db/external-jobs";
import { addModerationLog } from "@/lib/data";
import { approvalProblem, HIDE_REASONS, parseHide, parseNote, parseTakedown } from "@/lib/external-jobs/review";
import { isShown } from "@/lib/external-jobs/visibility";
import type { ExternalSource } from "@/lib/external-jobs/types";
import { describeAction } from "@/app/admin/moderation";
import { REFUSED_ZH, requireModerator } from "@/app/admin/moderator";
import type { AdminResult, Refused } from "@/app/admin/actions";

export interface ExternalCompanyItem {
  id: string;
  name: string;
  source?: ExternalSource;
  careersUrl?: string;
  /** On the hand-kept list (src/config/external-companies.ts); jobs of other companies are demo data. */
  onList: boolean;
  terms: TermsCheck | null;
  imported: boolean;
  block?: CompanyBlock;
  pending: number;
  shown: number;
}

export interface ExternalJobItem extends ExternalJob {
  shown: boolean;
}

export interface ExternalReviewQueue {
  at: number;
  companies: ExternalCompanyItem[];
  /** Waiting for review and still in the feed, flagged ones first, then oldest first. */
  pending: ExternalJobItem[];
  /** Approved and still in the feed; `shown` is false when its last refresh is too old or its closing day is over. */
  approved: ExternalJobItem[];
}

export async function getExternalReview(): Promise<ExternalReviewQueue | Refused> {
  const me = await requireModerator();
  if (!me.ok) return { refused: me.reason, error_zh: REFUSED_ZH[me.reason] };
  const now = Date.now();
  const [jobs, blocks] = await Promise.all([listExternalJobs(), listCompanyBlocks()]);
  const items = jobs.map((job) => ({ ...job, shown: isShown(job, now) }));
  const up = items.filter((job) => job.removedAt == null);

  const ids = [...new Set([...EXTERNAL_COMPANIES.map((c) => c.id), ...jobs.map((j) => j.companyId)])];
  const companies = ids.map((id): ExternalCompanyItem => {
    const listed = EXTERNAL_COMPANIES.find((c) => c.id === id);
    const block = blocks.find((b) => b.companyId === id);
    const own = up.filter((job) => job.companyId === id);
    return {
      id,
      name: listed?.name ?? jobs.find((j) => j.companyId === id)?.companyName ?? id,
      ...(listed && { source: listed.source, careersUrl: listed.careersUrl }),
      onList: Boolean(listed),
      terms: listed?.terms ?? null,
      imported: Boolean(listed && importAllowed(listed)) && !block,
      ...(block && { block }),
      pending: own.filter((job) => job.review === "pending").length,
      shown: own.filter((job) => job.shown).length,
    };
  });

  return {
    at: now,
    companies,
    pending: up
      .filter((job) => job.review === "pending")
      .sort((a, b) => b.flags.length - a.flags.length || a.firstSeenAt.localeCompare(b.firstSeenAt)),
    approved: up.filter((job) => job.review === "approved"),
  };
}

async function acting(): Promise<{ email: string } | { refused: AdminResult }> {
  const me = await requireModerator();
  return me.ok ? { email: me.email } : { refused: { ok: false, error_zh: REFUSED_ZH[me.reason] } };
}

/** 通过: the job shows in 实习 or 专业职位. A flagged job needs `flagsChecked` (the moderator read the original). */
export async function approveExternalJob(id: unknown, flagsChecked: unknown): Promise<AdminResult> {
  const me = await acting();
  if ("refused" in me) return me.refused;
  const job = typeof id === "string" ? await getExternalJob(id) : undefined;
  if (!job) return { ok: false, error_zh: "找不到这个职位。" };
  if (job.review === "approved") return { ok: false, error_zh: "这个职位已经通过了。" };
  const problem = approvalProblem(job, flagsChecked === true);
  if (problem) return { ok: false, error_zh: problem };
  await setExternalReview(job.id, "approved");
  const entry = await addModerationLog({
    action: "external_approve",
    jobId: job.id,
    jobTitle: job.title,
    employerName: job.companyName,
    ...(job.flags.length > 0 && { note: "已核对原文中的特殊要求" }),
    moderator: me.email,
  });
  return { ok: true, text: describeAction(entry) };
}

/** 不显示: the job stays out of the sections (also for one already approved), with a reason. */
export async function hideExternalJob(id: unknown, reason: unknown, note: unknown): Promise<AdminResult> {
  const me = await acting();
  if ("refused" in me) return me.refused;
  const parsed = parseHide(reason, note);
  if (!parsed.ok) return parsed;
  const job = typeof id === "string" ? await getExternalJob(id) : undefined;
  if (!job) return { ok: false, error_zh: "找不到这个职位。" };
  if (job.review === "hidden") return { ok: false, error_zh: "这个职位已经不显示了。" };
  await setExternalReview(job.id, "hidden");
  const why = HIDE_REASONS[parsed.value.reason];
  const entry = await addModerationLog({
    action: "external_hide",
    jobId: job.id,
    jobTitle: job.title,
    employerName: job.companyName,
    note: parsed.value.note ? `${why}：${parsed.value.note}` : why,
    moderator: me.email,
  });
  return { ok: true, text: describeAction(entry) };
}

async function companyName(id: string): Promise<string | undefined> {
  return (
    EXTERNAL_COMPANIES.find((c) => c.id === id)?.name ?? (await listExternalJobs({ companyId: id }))[0]?.companyName
  );
}

/** 停用这家公司: not imported any more, and all its jobs come down now. */
export async function stopExternalCompany(companyId: unknown, note: unknown): Promise<AdminResult> {
  const me = await acting();
  if ("refused" in me) return me.refused;
  const parsed = parseNote(note);
  if (!parsed.ok) return parsed;
  const name = typeof companyId === "string" ? await companyName(companyId) : undefined;
  if (!name) return { ok: false, error_zh: "找不到这家公司。" };
  const done = await blockCompany(companyId as string, { kind: "stopped", note: parsed.value });
  if (done === "already") return { ok: false, error_zh: "这家公司已经停用了。" };
  const entry = await addModerationLog({
    action: "external_stop",
    employerName: name,
    takenDown: done.takenDown,
    note: parsed.value,
    moderator: me.email,
  });
  return { ok: true, text: describeAction(entry) };
}

/** 公司要求删除: recorded with who asked, the company stops being imported and every job of it comes down today. */
export async function recordTakedownRequest(
  companyId: unknown,
  requester: unknown,
  note: unknown,
): Promise<AdminResult> {
  const me = await acting();
  if ("refused" in me) return me.refused;
  const parsed = parseTakedown(requester, note);
  if (!parsed.ok) return parsed;
  const name = typeof companyId === "string" ? await companyName(companyId) : undefined;
  if (!name) return { ok: false, error_zh: "找不到这家公司。" };
  const done = await blockCompany(companyId as string, { kind: "takedown", ...parsed.value });
  if (done === "already") return { ok: false, error_zh: "这家公司的删除请求已经记录过了。" };
  const entry = await addModerationLog({
    action: "external_takedown",
    employerName: name,
    takenDown: done.takenDown,
    note: `${parsed.value.requester}：${parsed.value.note}`,
    moderator: me.email,
  });
  return { ok: true, text: describeAction(entry) };
}

/** 恢复导入: the next import reads the company again; its jobs come back waiting for review. */
export async function resumeExternalCompany(companyId: unknown, note: unknown): Promise<AdminResult> {
  const me = await acting();
  if ("refused" in me) return me.refused;
  const parsed = parseNote(note);
  if (!parsed.ok) return parsed;
  const name = typeof companyId === "string" ? await companyName(companyId) : undefined;
  if (!name || !(await unblockCompany(companyId as string))) return { ok: false, error_zh: "这家公司没有停用。" };
  const entry = await addModerationLog({
    action: "external_resume",
    employerName: name,
    note: parsed.value,
    moderator: me.email,
  });
  return { ok: true, text: describeAction(entry) };
}
