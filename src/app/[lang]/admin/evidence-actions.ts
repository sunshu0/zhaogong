"use server";

// 举报证据 for /admin (#353, ADR 0027 §3): the messages and screenshots one job report carries, when a moderator opens
// them. A moderator only (requireModerator, as every /admin Server Function). The messages are someone's words, so
// handing them over is recorded first (ADR 0026: kind chat, the report's id); each screenshot is recorded again by
// its own route (/api/report-evidence/[id]), within the same view.
import { listReports } from "@/lib/data";
import { recordViews } from "@/db/personal-info-views";
import { listReportEvidence, type ReportEvidence } from "@/db/report-evidence";
import { refusedText, requireModerator } from "@/app/[lang]/admin/moderator";
import type { Refused } from "@/app/[lang]/admin/actions";

/** A report's evidence: the messages in the order they were sent, then the screenshots. */
export async function getReportEvidence(reportId: unknown): Promise<{ evidence: ReportEvidence[] } | Refused> {
  const me = await requireModerator();
  if (!me.ok) return { refused: me.reason, error_zh: await refusedText(me.reason) };
  const id = typeof reportId === "string" ? reportId : "";
  if (!(await listReports()).some((r) => r.id === id)) return { evidence: [] };
  const all = await listReportEvidence(id);
  if (all.some((e) => e.kind === "message")) await recordViews(me.email, "chat", [id]);
  return {
    evidence: [...all.filter((e) => e.kind === "message"), ...all.filter((e) => e.kind === "image")],
  };
}
