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
import { useSession } from "@/components/seeker/session-client";
import { identityScope } from "@/components/seeker/identity-scope";
import { readSession, type DemoSession } from "@/components/seeker/session";
import {
  identityActivityStorage,
  parseActivityAccounts,
  scopedActivityKey,
} from "@/components/seeker/identity-activity";

const reports = createLocalStore(scopedActivityKey(REPORTS_KEY), parseActivityAccounts);
const views = createLocalStore(scopedActivityKey(VIEWS_KEY), parseActivityAccounts);

/** Reports sent from this device, newest first. Empty during server rendering and hydration. */
export function useSentReports(): SentReport[] {
  const scope = identityScope(useSession());
  return parseSentReports(JSON.stringify(reports.useValue()[scope] ?? []));
}

export function rememberReport(report: SentReport, owner?: DemoSession | null): void {
  reports.update((storage) =>
    addSentReport(
      identityActivityStorage(storage, identityScope(owner === undefined ? readSession(storage) : owner)),
      report,
    ),
  );
}

/** Jobs viewed on this device, most recent first. Empty during server rendering and hydration. */
export function useViewedJobs(): ViewedJob[] {
  const scope = identityScope(useSession());
  return parseViewedJobs(JSON.stringify(views.useValue()[scope] ?? []));
}

export function rememberView(view: ViewedJob): void {
  views.update((storage) => addViewedJob(identityActivityStorage(storage, identityScope(readSession(storage))), view));
}

export function forgetViews(): void {
  views.update((storage) => clearViewedJobs(identityActivityStorage(storage, identityScope(readSession(storage)))));
}
