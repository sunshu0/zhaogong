// What a moderator may do with external jobs and companies (#112, ADR 0014), checked the same way in the browser and
// on the server. Pure.
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { externalWords } from "@/lib/external-jobs/labels";
import type { ExternalFlag } from "@/lib/external-jobs/types";

export type HideReason = "requirement" | "wrong_field" | "wrong_facts" | "other";

/** Why a moderator does not show a job, in the reader's language (Round 20). */
export function hideReasons(lang: Lang = DEFAULT_LANG): Record<HideReason, string> {
  return externalWords(lang).hideReasons;
}

/** The reasons in Chinese, for callers with no language to hand. */
export const HIDE_REASONS: Record<HideReason, string> = hideReasons();

type Parsed<T> = { ok: true; value: T } | { ok: false; error_zh: string };

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** 不显示: a reason, and a note when the reason is 其他. */
export function parseHide(
  reason: unknown,
  note: unknown,
  lang: Lang = DEFAULT_LANG,
): Parsed<{ reason: HideReason; note: string }> {
  const t = externalWords(lang).reviewErrors;
  if (typeof reason !== "string" || !(reason in HIDE_REASONS)) return { ok: false, error_zh: t.pickReason };
  const n = text(note, 200);
  if (reason === "other" && !n) return { ok: false, error_zh: t.otherNeedsNote };
  return { ok: true, value: { reason: reason as HideReason, note: n } };
}

/**
 * 通过: only a job still in its company's feed, and one with flags only once the moderator has read the original
 * and ticked that the requirement is a lawful one for the role (an export-control rule, say).
 */
export function approvalProblem(
  job: { removedAt: string | null; flags: ExternalFlag[] },
  flagsChecked: boolean,
  lang: Lang = DEFAULT_LANG,
): string | undefined {
  const w = externalWords(lang);
  if (job.removedAt) return w.reviewErrors.removed;
  if (job.flags.length && !flagsChecked) return w.reviewErrors.checkFlags(job.flags.map((f) => w.flags[f]));
  return undefined;
}

/** 停用这家公司 / 恢复导入: a note saying why. */
export function parseNote(note: unknown, lang: Lang = DEFAULT_LANG): Parsed<string> {
  const n = text(note, 200);
  return n ? { ok: true, value: n } : { ok: false, error_zh: externalWords(lang).reviewErrors.reasonMissing };
}

/** 公司要求删除: who asked (a company address or role) and what they asked. */
export function parseTakedown(
  requester: unknown,
  note: unknown,
  lang: Lang = DEFAULT_LANG,
): Parsed<{ requester: string; note: string }> {
  const t = externalWords(lang).reviewErrors;
  const r = text(requester, 120);
  const n = text(note, 300);
  if (!r) return { ok: false, error_zh: t.requesterMissing };
  if (!n) return { ok: false, error_zh: t.requestMissing };
  return { ok: true, value: { requester: r, note: n } };
}
