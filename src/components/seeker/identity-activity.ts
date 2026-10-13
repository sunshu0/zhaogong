import { REPORTS_KEY, VIEWS_KEY, parseSentReports, parseViewedJobs } from "@/components/seeker/activity";
import { identityScope, parseIdentityMap } from "@/components/seeker/identity-scope";
import type { DemoSession, StorageLike } from "@/components/seeker/session";

export const scopedActivityKey = (key: string) => `${key}:identities`;
export function parseActivityAccounts(raw: string | null): Record<string, unknown[]> {
  return parseIdentityMap(raw, (value) => Array.isArray(value) ? value : undefined);
}

export function identityActivityStorage(storage: StorageLike, scope: string): StorageLike {
  return {
    getItem(key) {
      const accounts = parseActivityAccounts(storage.getItem(scopedActivityKey(key)));
      return accounts[scope] ? JSON.stringify(accounts[scope]) : null;
    },
    setItem(key, value) {
      const storageKey = scopedActivityKey(key);
      const accounts = parseActivityAccounts(storage.getItem(storageKey));
      storage.setItem(storageKey, JSON.stringify({ ...accounts, [scope]: JSON.parse(value) }));
    },
    removeItem(key) {
      const storageKey = scopedActivityKey(key);
      const accounts = parseActivityAccounts(storage.getItem(storageKey));
      delete accounts[scope];
      storage.setItem(storageKey, JSON.stringify(accounts));
    },
  };
}

/** Attribute new guest activity once at sign-in, then remove it from the guest bucket. */
export function claimGuestActivity(storage: StorageLike, session: DemoSession) {
  if (session.activeRole !== "seeker") return;
  const guest = identityActivityStorage(storage, "guest");
  const account = identityActivityStorage(storage, identityScope(session));
  const views = parseViewedJobs(guest.getItem(VIEWS_KEY));
  if (views.length) {
    const own = parseViewedJobs(account.getItem(VIEWS_KEY));
    account.setItem(VIEWS_KEY, JSON.stringify([...views, ...own.filter((item) => !views.some((view) => view.jobId === item.jobId))].slice(0, 30)));
    guest.removeItem(VIEWS_KEY);
  }
  const reports = parseSentReports(guest.getItem(REPORTS_KEY));
  if (reports.length) {
    const own = parseSentReports(account.getItem(REPORTS_KEY));
    account.setItem(REPORTS_KEY, JSON.stringify([...reports, ...own.filter((item) => !reports.some((report) => report.reportId === item.reportId))].slice(0, 50)));
    guest.removeItem(REPORTS_KEY);
  }
}
