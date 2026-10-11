// What a job seeker did on this device (demo, no backend): reports sent. Functions take the storage
// as an argument so they can be unit-tested; components use the hooks in activity-client.ts.
import type { ReportReason } from "@/lib/types";
import { isReportReason } from "@/components/seeker/report";
import type { StorageLike } from "@/components/seeker/session";

export const REPORTS_KEY = "zhaogong:reports-sent";
const MAX_ENTRIES = 50;

export interface SentReport {
  reportId: string;
  jobId: string;
  jobTitle: string;
  reason: ReportReason;
  at: string;
}

function isSentReport(value: unknown): value is SentReport {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.reportId === "string" &&
    typeof r.jobId === "string" &&
    typeof r.jobTitle === "string" &&
    typeof r.at === "string" &&
    isReportReason(r.reason)
  );
}

/** Parses the stored list, dropping anything malformed. */
export function parseSentReports(raw: string | null): SentReport[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter(isSentReport) : [];
  } catch {
    return [];
  }
}

export function readSentReports(storage: StorageLike): SentReport[] {
  return parseSentReports(storage.getItem(REPORTS_KEY));
}

/** Adds a report to the front of the list, keeping the newest 50. */
export function addSentReport(storage: StorageLike, report: SentReport): SentReport[] {
  const list = [report, ...readSentReports(storage)].slice(0, MAX_ENTRIES);
  storage.setItem(REPORTS_KEY, JSON.stringify(list));
  return list;
}
