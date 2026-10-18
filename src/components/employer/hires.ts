// "通过找工招到人了吗？" — asked when an employer ends a job; the landing page adds the counts up.
// Optional: skipping it records nothing. 没有 / 不确定 records 0, so an answer is told apart from none.
import { PRODUCT_NAME } from "@/i18n/labels";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { employerJobsMessages } from "@/i18n/messages/employer-jobs";
import type { Job } from "@/lib/types";

export const MAX_HIRES = 20;

export type HiresAnswer = { hired: true; count: number } | { hired: false };

type HireFields = Pick<Job, "hiresConfirmed" | "hiresConfirmedAt">;

/** Checks an answer from the browser and turns it into the fields to save. */
export function hiresFromAnswer(
  answer: unknown,
  now: number,
  lang: Lang = DEFAULT_LANG,
): { ok: true; fields: Partial<HireFields> } | { ok: false; error_zh: string } {
  const t = pick(employerJobsMessages, lang).hires;
  if (answer == null) return { ok: true, fields: {} };
  if (typeof answer !== "object" || typeof (answer as { hired?: unknown }).hired !== "boolean") {
    return { ok: false, error_zh: t.chooseAnswer };
  }
  const at = new Date(now).toISOString();
  if (!(answer as HiresAnswer).hired) return { ok: true, fields: { hiresConfirmed: 0, hiresConfirmedAt: at } };
  const count = (answer as { count?: unknown }).count;
  if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > MAX_HIRES) {
    return { ok: false, error_zh: t.countRange(MAX_HIRES) };
  }
  return { ok: true, fields: { hiresConfirmed: count, hiresConfirmedAt: at } };
}

export function hiresLabelZh(job: Pick<Job, "hiresConfirmed">, lang: Lang = DEFAULT_LANG): string | undefined {
  const t = pick(employerJobsMessages, lang).hires;
  if (job.hiresConfirmed == null) return undefined;
  return job.hiresConfirmed > 0 ? t.hiredCount(job.hiresConfirmed) : t.noneHired(PRODUCT_NAME);
}
