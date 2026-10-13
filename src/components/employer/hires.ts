// "通过找工招到人了吗？" — asked when an employer ends a job; the landing page adds the counts up.
// Optional: skipping it records nothing. 没有 / 不确定 records 0, so an answer is told apart from none.
import { PRODUCT_NAME } from "@/i18n/labels";
import type { Job } from "@/lib/types";

export const MAX_HIRES = 20;

export type HiresAnswer = { hired: true; count: number } | { hired: false };

type HireFields = Pick<Job, "hiresConfirmed" | "hiresConfirmedAt">;

/** Checks an answer from the browser and turns it into the fields to save. */
export function hiresFromAnswer(
  answer: unknown,
  now: number,
): { ok: true; fields: Partial<HireFields> } | { ok: false; error_zh: string } {
  if (answer == null) return { ok: true, fields: {} };
  if (typeof answer !== "object" || typeof (answer as { hired?: unknown }).hired !== "boolean") {
    return { ok: false, error_zh: "请选择招到了，或者没有 / 不确定。" };
  }
  const at = new Date(now).toISOString();
  if (!(answer as HiresAnswer).hired) return { ok: true, fields: { hiresConfirmed: 0, hiresConfirmedAt: at } };
  const count = (answer as { count?: unknown }).count;
  if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > MAX_HIRES) {
    return { ok: false, error_zh: `人数请填 1 到 ${MAX_HIRES}。` };
  }
  return { ok: true, fields: { hiresConfirmed: count, hiresConfirmedAt: at } };
}

export function hiresLabelZh(job: Pick<Job, "hiresConfirmed">): string | undefined {
  if (job.hiresConfirmed == null) return undefined;
  return job.hiresConfirmed > 0 ? `已招到 ${job.hiresConfirmed} 人` : `没有通过${PRODUCT_NAME}招到人`;
}
