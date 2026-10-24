// Moderation queue helpers: grouping reports and wording the log. The log itself is in data.ts.
import { REPORT_REASON_LABELS } from "@/i18n/labels";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { adminMessages } from "@/i18n/messages/admin";
import { DELETED_ACCOUNT } from "@/lib/deleted-account";
import { publishDecision, type Finding } from "@/lib/compliance";
import type { Employer, ModerationLogEntry, Report, ReportReason } from "@/lib/types";

/**
 * Why 通过 would be refused for a job waiting for review (#295), one rule for approveJob and the queue's card: the
 * employer is banned, or today's rules still stop the job. Undefined when it can be approved.
 */
export function approveBlocker(
  employer: Pick<Employer, "bannedAt"> | undefined,
  findings: Finding[],
): "employerBanned" | "stillBlocked" | undefined {
  if (employer?.bannedAt) return "employerBanned";
  return publishDecision(findings).canPublish ? undefined : "stillBlocked";
}

export function ruleLabel(rule: string, lang: Lang = DEFAULT_LANG): string {
  const rules: Record<string, string> = pick(adminMessages, lang).rules;
  return rules[rule] ?? rule;
}

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
export function moderatorLabel(moderator: string | undefined, lang: Lang = DEFAULT_LANG): string {
  const t = pick(adminMessages, lang).log;
  if (!moderator) return t.oldEntry;
  return moderator === DELETED_ACCOUNT ? t.deletedModerator : moderator;
}

export function describeAction(entry: ModerationLogEntry, lang: Lang = DEFAULT_LANG): string {
  const t = pick(adminMessages, lang).log;
  const employer = entry.employerName ?? "";
  const job = t.job(entry.jobTitle ?? "", employer);
  const why = entry.reasons?.length
    ? t.reasons(REASON_ORDER.filter((r) => entry.reasons!.includes(r)).map((r) => REPORT_REASON_LABELS[r][lang]))
    : entry.rules?.length
      ? t.rules(unique(entry.rules).map((r) => ruleLabel(r, lang)))
      : "";
  // A note is the moderator's own words (or what was stored with the decision): kept as written.
  const note = entry.note ? t.note(entry.note) : "";
  const takenDown = entry.takenDown ?? 0;
  switch (entry.action) {
    case "approve":
      return t.approve(job, why);
    case "take_down":
      return t.takeDown(job, why);
    case "dismiss":
      return t.dismiss(job, why);
    case "ban":
      return t.ban(employer, takenDown);
    case "verify_approve":
      return t.verifyApprove(employer, note);
    case "verify_reject":
      return t.verifyReject(employer, note);
    case "external_approve":
      return t.externalApprove(job);
    case "external_hide":
      return t.externalHide(job, note);
    case "external_stop":
      return t.externalStop(employer, takenDown, note);
    case "external_resume":
      return t.externalResume(employer, note);
    case "external_takedown":
      return t.externalTakedown(employer, takenDown, note);
    case "chat_risk_close":
      return t.chatRiskClose(employer, why, note);
  }
}
