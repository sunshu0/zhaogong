// Checks a job report before it is sent. Used by the report form and again by the server action.
import { REPORT_REASON_LABELS } from "@/i18n/labels";
import type { ReportReason } from "@/lib/types";

export const NOTE_MAX = 500;

export const REPORT_REASONS = Object.keys(REPORT_REASON_LABELS) as ReportReason[];

export type ParsedReport = { ok: true; reason: ReportReason; note?: string } | { ok: false; error: string };

export function isReportReason(value: unknown): value is ReportReason {
  return typeof value === "string" && (REPORT_REASONS as string[]).includes(value);
}

export function parseReport(input: { reason: string | undefined; note?: string }): ParsedReport {
  if (!isReportReason(input.reason)) return { ok: false, error: "请选择举报原因" };
  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (note.length > NOTE_MAX) return { ok: false, error: `补充说明最多 ${NOTE_MAX} 字` };
  if (input.reason === "other" && !note) return { ok: false, error: "选择“其他”时，请简单写一下原因" };
  return note ? { ok: true, reason: input.reason, note } : { ok: true, reason: input.reason };
}
