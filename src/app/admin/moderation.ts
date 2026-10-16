// Moderation queue helpers: grouping reports and wording the log. The log itself is in data.ts.
import { REPORT_REASON_LABELS } from "@/i18n/labels";
import type { RuleId } from "@/lib/compliance";
import { DELETED_ACCOUNT } from "@/lib/deleted-account";
import type { ModerationLogEntry, Report, ReportReason } from "@/lib/types";

export const RULE_LABELS: Record<RuleId, string> = {
  min_wage: "低于最低工资",
  fee: "收费用词",
  visa_selling: "卖签证用词",
  ethnic_preference: "按种族或国籍招人",
  high_risk: "高风险行业",
  aewv_unaccredited: "非认证雇主招 AEWV",
};

export interface ReportGroup {
  jobId: string;
  /** Newest first. */
  reports: Report[];
}

/** Open reports per job: the most reported job first, then the most recent. */
export function groupOpenReports(reports: Report[]): ReportGroup[] {
  const byJob = new Map<string, Report[]>();
  for (const r of reports) if (r.status === "open") byJob.set(r.jobId, [...(byJob.get(r.jobId) ?? []), r]);
  return [...byJob.entries()]
    .map(([jobId, list]) => ({ jobId, reports: list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }))
    .sort(
      (a, b) => b.reports.length - a.reports.length || b.reports[0].createdAt.localeCompare(a.reports[0].createdAt),
    );
}

const unique = <T>(list: T[] = []) => [...new Set(list)];
/** Reasons always in the same order, so a log line does not depend on which report came first. */
const REASON_ORDER = Object.keys(REPORT_REASON_LABELS) as ReportReason[];

/** Who acted, for the log (#60). */
export function moderatorLabel(moderator: string | undefined): string {
  if (!moderator) return "（较早的记录，未记审核员）";
  return moderator === DELETED_ACCOUNT ? "已删除的审核员" : moderator;
}

export function describeAction(entry: ModerationLogEntry): string {
  const job = `「${entry.jobTitle}」（${entry.employerName}）`;
  const why = entry.reasons?.length
    ? ` · 举报：${REASON_ORDER.filter((r) => entry.reasons!.includes(r))
        .map((r) => REPORT_REASON_LABELS[r].zh)
        .join("、")}`
    : entry.rules?.length
      ? ` · 标记：${unique(entry.rules)
          .map((r) => RULE_LABELS[r as RuleId] ?? r)
          .join("、")}`
      : "";
  switch (entry.action) {
    case "approve":
      return `审核通过${job}${why}`;
    case "take_down":
      return `下架${job}${why}`;
    case "dismiss":
      return `驳回对${job}的举报${why}`;
    case "ban":
      return `封禁雇主「${entry.employerName}」，下架 ${entry.takenDown ?? 0} 个职位`;
    case "verify_approve":
      return `通过企业验证「${entry.employerName}」${entry.note ? ` · ${entry.note}` : ""}`;
    case "verify_reject":
      return `驳回企业验证「${entry.employerName}」${entry.note ? ` · ${entry.note}` : ""}`;
    case "external_approve":
      return `通过外部职位${job}`;
    case "external_hide":
      return `不显示外部职位${job}${entry.note ? ` · ${entry.note}` : ""}`;
    case "external_stop":
      return `停用外部公司「${entry.employerName}」，下架 ${entry.takenDown ?? 0} 个职位${entry.note ? ` · ${entry.note}` : ""}`;
    case "external_resume":
      return `恢复导入外部公司「${entry.employerName}」${entry.note ? ` · ${entry.note}` : ""}`;
    case "external_takedown":
      return `公司要求删除「${entry.employerName}」，下架 ${entry.takenDown ?? 0} 个职位${entry.note ? ` · ${entry.note}` : ""}`;
  }
}
