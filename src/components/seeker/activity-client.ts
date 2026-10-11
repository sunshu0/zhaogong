"use client";

import { addSentReport, parseSentReports, REPORTS_KEY, type SentReport } from "@/components/seeker/activity";
import { createLocalStore } from "@/components/seeker/local-store";

const reports = createLocalStore(REPORTS_KEY, parseSentReports);

/** Reports sent from this device, newest first. Empty during server rendering and hydration. */
export function useSentReports(): SentReport[] {
  return reports.useValue();
}

export function rememberReport(report: SentReport): void {
  reports.update((storage) => addSentReport(storage, report));
}
