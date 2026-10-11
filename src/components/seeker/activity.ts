// What a job seeker did on this device (demo, no backend): jobs viewed and reports sent. Functions take the storage
// as an argument so they can be unit-tested; components use the hooks in activity-client.ts.
import type { ReportReason } from "@/lib/types";
import { isReportReason } from "@/components/seeker/report";
import type { StorageLike } from "@/components/seeker/session";

export const REPORTS_KEY = "zhaogong:reports-sent";
export const VIEWS_KEY = "zhaogong:viewed-jobs";
const MAX_REPORTS = 50;
const MAX_VIEWS = 30;

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
  const list = [report, ...readSentReports(storage)].slice(0, MAX_REPORTS);
  storage.setItem(REPORTS_KEY, JSON.stringify(list));
  return list;
}

/** A job page seen on this device, with what /me needs to list it without loading the job. */
export interface ViewedJob {
  jobId: string;
  title: string;
  pay: string;
  region: string;
  at: string;
}

function isViewedJob(value: unknown): value is ViewedJob {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return [v.jobId, v.title, v.pay, v.region, v.at].every((field) => typeof field === "string");
}

export function parseViewedJobs(raw: string | null): ViewedJob[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter(isViewedJob) : [];
  } catch {
    return [];
  }
}

export function readViewedJobs(storage: StorageLike): ViewedJob[] {
  return parseViewedJobs(storage.getItem(VIEWS_KEY));
}

/** Puts the job at the front (once), keeping the latest 30. */
export function addViewedJob(storage: StorageLike, view: ViewedJob): ViewedJob[] {
  const list = [view, ...readViewedJobs(storage).filter((v) => v.jobId !== view.jobId)].slice(0, MAX_VIEWS);
  storage.setItem(VIEWS_KEY, JSON.stringify(list));
  return list;
}

export function clearViewedJobs(storage: StorageLike): void {
  storage.removeItem(VIEWS_KEY);
}
