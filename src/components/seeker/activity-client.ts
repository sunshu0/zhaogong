"use client";

import {
  addSentReport,
  addViewedJob,
  clearViewedJobs,
  parseSentReports,
  parseViewedJobs,
  REPORTS_KEY,
  VIEWS_KEY,
  type SentReport,
  type ViewedJob,
} from "@/components/seeker/activity";
import { createLocalStore } from "@/components/seeker/local-store";

const reports = createLocalStore(REPORTS_KEY, parseSentReports);
const views = createLocalStore(VIEWS_KEY, parseViewedJobs);

/** Reports sent from this device, newest first. Empty during server rendering and hydration. */
export function useSentReports(): SentReport[] {
  return reports.useValue();
}

export function rememberReport(report: SentReport): void {
  reports.update((storage) => addSentReport(storage, report));
}

/** Jobs viewed on this device, most recent first. Empty during server rendering and hydration. */
export function useViewedJobs(): ViewedJob[] {
  return views.useValue();
}

export function rememberView(view: ViewedJob): void {
  views.update((storage) => addViewedJob(storage, view));
}

export function forgetViews(): void {
  views.update(clearViewedJobs);
}
