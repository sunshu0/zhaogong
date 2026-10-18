// Real external jobs in the demo database (导师 10-19, for the user: 「我就是让你找真实职位然后跳转」). When the dev
// server makes a fresh demo database (or npm run db:seed does), it imports the real jobs of the companies on the list
// (src/config/external-companies.ts), the demo moderator approves the ones with nothing to check, each in the
// moderation log, and the made-up demo-… jobs come down. Flagged jobs wait in 审核后台 as usual. Offline, the made-up
// ones stay and 审核后台 says so. The browser tests and the unit tests keep the made-up jobs: they need fixed data.
// Every company goes through the usual import: its terms checked (ADR 0014), polite-fetch, blocks obeyed. The whole
// import has 30 s; what is not read by then fails like an unreadable feed, and a failure is only logged.
// Never in production: there, 先审后显示 holds for every job. Server only.
import { EXTERNAL_COMPANIES, type ExternalCompany } from "@/config/external-companies";
import { listExternalJobs, setExternalReview, takeDownCompany } from "@/db/external-jobs";
import { addModerationLog } from "@/lib/data";
import { DEMO_MODERATOR } from "@/lib/demo-accounts";
import { isDemoCompany } from "@/lib/external-jobs/demo";
import { importExternalJobs, type CompanyReport } from "@/lib/external-jobs/import";
import { politeFetcher } from "@/lib/external-jobs/polite-fetch";

/** How long the whole import into a fresh demo database may take. */
export const DEMO_IMPORT_DEADLINE_MS = 30_000;

/** The getter, but every request after `ms` from now fails at once, and one still waiting then fails too. */
export function withDeadline(
  getJson: (url: string) => Promise<unknown>,
  ms: number,
  clock: () => number = Date.now,
): (url: string) => Promise<unknown> {
  const end = clock() + ms;
  const late = () => new Error(`the import's ${ms / 1000} s were up`);
  return (url) => {
    const left = end - clock();
    if (left <= 0) return Promise.reject(late());
    let timer: ReturnType<typeof setTimeout> | undefined;
    const up = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(late()), left);
    });
    return Promise.race([getJson(url), up]).finally(() => clearTimeout(timer));
  };
}

/** The moderation log's note on a job the demo database approved by itself. Stored as written, like every note. */
export const AUTO_APPROVED_NOTE = "演示库建库时自动通过：没有需要核对的标记";

/** Once real jobs are in, the made-up companies' jobs come down (not deleted: someone may have saved one). */
export async function retireDemoExternalJobs(now = new Date()): Promise<number> {
  const up = (await listExternalJobs()).filter((job) => job.removedAt == null && isDemoCompany(job.companyId));
  let n = 0;
  for (const company of new Set(up.map((job) => job.companyId))) n += await takeDownCompany(company, now);
  return n;
}

export interface DemoImport {
  reports: CompanyReport[];
  /** Whether any company's real jobs came in; if not (offline), the made-up jobs stay. */
  imported: boolean;
  approved: number;
  retired: number;
}

export async function importRealJobsIntoDemo({
  getJson,
  companies = EXTERNAL_COMPANIES,
  now = () => new Date(),
  deadlineMs = DEMO_IMPORT_DEADLINE_MS,
}: {
  getJson: (url: string) => Promise<unknown>;
  companies?: ExternalCompany[];
  now?: () => Date;
  deadlineMs?: number;
}): Promise<DemoImport> {
  const reports = await importExternalJobs({ companies, getJson: withDeadline(getJson, deadlineMs), now });
  const imported = reports.some((r) => r.status === "imported" && r.kept > 0);
  if (!imported) return { reports, imported, approved: 0, retired: 0 };
  let approved = 0;
  for (const job of await listExternalJobs()) {
    if (isDemoCompany(job.companyId) || job.review !== "pending" || job.removedAt != null || job.flags.length > 0) {
      continue;
    }
    await setExternalReview(job.id, "approved", now());
    await addModerationLog({
      action: "external_approve",
      jobId: job.id,
      jobTitle: job.title,
      employerName: job.companyName,
      note: AUTO_APPROVED_NOTE,
      moderator: DEMO_MODERATOR,
    });
    approved += 1;
  }
  return { reports, imported, approved, retired: await retireDemoExternalJobs(now()) };
}

/**
 * The import as ready.ts and db:seed run it, on the network through polite-fetch. Never throws: the demo database is
 * made either way, and the line says what happened.
 */
export async function runDemoImport(get: typeof fetch = fetch): Promise<string> {
  try {
    return describeDemoImport(await importRealJobsIntoDemo({ getJson: politeFetcher({ fetch: get }) }));
  } catch (error) {
    return `External jobs: the import failed, so the demo keeps its made-up ones (${error instanceof Error ? error.message : String(error)}).`;
  }
}

/** One line for the server's or the command's output. */
export function describeDemoImport({ reports, imported, approved, retired }: DemoImport): string {
  if (!imported) {
    const why = reports.map((r) => (r.status === "failed" ? `${r.company}: ${r.error}` : `${r.company}: ${r.status}`));
    return `External jobs: no real jobs could be read, so the demo keeps its made-up ones (${why.join("; ")}).`;
  }
  return `External jobs: real jobs imported, ${approved} approved by the demo moderator, ${retired} made-up ones taken down.`;
}
