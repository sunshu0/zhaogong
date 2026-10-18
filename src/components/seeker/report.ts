// Checks a job report before it is sent. Used by the report form and again by the server action.
import { REPORT_REASON_LABELS } from "@/i18n/labels";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { seekerJobsMessages } from "@/i18n/messages/seeker-jobs";
import type { ReportReason } from "@/lib/types";

export const NOTE_MAX = 500;

export const REPORT_REASONS = Object.keys(REPORT_REASON_LABELS) as ReportReason[];

export type ParsedReport = { ok: true; reason: ReportReason; note?: string } | { ok: false; error: string };

export function isReportReason(value: unknown): value is ReportReason {
  return typeof value === "string" && (REPORT_REASONS as string[]).includes(value);
}

/** The report checked; its errors in the page's language (the form) or the visitor's (the Server Function). */
export function parseReport(
  input: { reason: string | undefined; note?: string },
  lang: Lang = DEFAULT_LANG,
): ParsedReport {
  const t = pick(seekerJobsMessages, lang).report;
  if (!isReportReason(input.reason)) return { ok: false, error: t.noReason };
  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (note.length > NOTE_MAX) return { ok: false, error: t.noteTooLong(NOTE_MAX) };
  if (input.reason === "other" && !note) return { ok: false, error: t.otherNeedsNote };
  return note ? { ok: true, reason: input.reason, note } : { ok: true, reason: input.reason };
}
