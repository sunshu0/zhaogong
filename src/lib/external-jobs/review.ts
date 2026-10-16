// What a moderator may do with external jobs and companies (#112, ADR 0014), checked the same way in the browser and
// on the server. Pure.
import { FLAG_LABELS } from "@/lib/external-jobs/labels";
import type { ExternalFlag } from "@/lib/external-jobs/types";

export const HIDE_REASONS = {
  requirement: "有按国籍、种族招人的要求",
  wrong_field: "不是软件或电子电气岗位",
  wrong_facts: "提取的事实和原文不符",
  other: "其他",
} as const;
export type HideReason = keyof typeof HIDE_REASONS;

type Parsed<T> = { ok: true; value: T } | { ok: false; error_zh: string };

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** 不显示: a reason, and a note when the reason is 其他. */
export function parseHide(reason: unknown, note: unknown): Parsed<{ reason: HideReason; note: string }> {
  if (typeof reason !== "string" || !(reason in HIDE_REASONS)) return { ok: false, error_zh: "请选一个不显示的理由。" };
  const n = text(note, 200);
  if (reason === "other" && !n) return { ok: false, error_zh: "选「其他」时请写明理由。" };
  return { ok: true, value: { reason: reason as HideReason, note: n } };
}

/**
 * 通过: only a job still in its company's feed, and one with flags only once the moderator has read the original
 * and ticked that the requirement is a lawful one for the role (an export-control rule, say).
 */
export function approvalProblem(
  job: { removedAt: string | null; flags: ExternalFlag[] },
  flagsChecked: boolean,
): string | undefined {
  if (job.removedAt) return "这个职位已经下架，不能通过。";
  if (job.flags.length && !flagsChecked)
    return `请先打开官网原文核对：${job.flags.map((f) => FLAG_LABELS[f]).join("；")}。`;
  return undefined;
}

/** 停用这家公司 / 恢复导入: a note saying why. */
export function parseNote(note: unknown): Parsed<string> {
  const n = text(note, 200);
  return n ? { ok: true, value: n } : { ok: false, error_zh: "请写明原因。" };
}

/** 公司要求删除: who asked (a company address or role) and what they asked. */
export function parseTakedown(requester: unknown, note: unknown): Parsed<{ requester: string; note: string }> {
  const r = text(requester, 120);
  const n = text(note, 300);
  if (!r) return { ok: false, error_zh: "请写明是谁提出的（公司邮箱或部门）。" };
  if (!n) return { ok: false, error_zh: "请写明请求的内容和收到的日期。" };
  return { ok: true, value: { requester: r, note: n } };
}
