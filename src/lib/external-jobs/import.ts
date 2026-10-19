// One import of external jobs (#111, ADR 0014): for each company on the list, read its public feed politely, keep
// the facts of the software and electrical jobs in New Zealand, and store them. A company whose terms nobody has
// checked is not read at all, and anything it had comes down. A feed that cannot be read leaves the company's jobs
// as they were; they stop showing on their own once their last refresh is 2 days old. A company taken off the list
// has its jobs taken down by a full import (takeDownUnlisted). Server only.
import { importAllowed, type ExternalCompany } from "@/config/external-companies";
import {
  listCompanyBlocks,
  listExternalJobs,
  saveCompanyFeed,
  takeDownCompany,
  type FeedResult,
} from "@/db/external-jobs";
import { isDemoCompany } from "@/lib/external-jobs/demo";
import { factsOf } from "@/lib/external-jobs/facts";
import { parsePostings, postingsUrl } from "@/lib/external-jobs/sources";
import type { ExternalFacts } from "@/lib/external-jobs/types";

export type CompanyReport =
  | { company: string; status: "terms_not_checked"; takenDown: number }
  | { company: string; status: "unlisted"; takenDown: number }
  | { company: string; status: "stopped"; kind: "stopped" | "takedown" }
  | { company: string; status: "failed"; error: string }
  | ({ company: string; status: "imported"; inFeed: number; kept: number } & FeedResult)
  | { company: string; status: "dry_run"; inFeed: number; jobs: ExternalFacts[] };

export interface ImportOptions {
  companies: ExternalCompany[];
  /** A polite JSON getter (polite-fetch.ts), or a fake one in tests. */
  getJson: (url: string) => Promise<unknown>;
  now?: () => Date;
  /** Read and show the facts without storing anything (and without taking anything down). */
  dryRun?: boolean;
}

export async function importExternalJobs({
  companies,
  getJson,
  now = () => new Date(),
  dryRun = false,
}: ImportOptions): Promise<CompanyReport[]> {
  const reports: CompanyReport[] = [];
  const blocks = new Map((await listCompanyBlocks()).map((b) => [b.companyId, b.kind]));
  for (const company of companies) {
    // Stopped by a moderator or at the company's request (#112): never read, not even for a dry run.
    const blocked = blocks.get(company.id);
    if (blocked) {
      reports.push({ company: company.id, status: "stopped", kind: blocked });
      continue;
    }
    if (!importAllowed(company) && !dryRun) {
      reports.push({ company: company.id, status: "terms_not_checked", takenDown: await takeDownCompany(company.id) });
      continue;
    }
    try {
      const postings = parsePostings(company.source, await getJson(postingsUrl(company.source, company.board)));
      const at = now();
      const jobs = postings.map((p) => factsOf(p, at)).filter((f): f is ExternalFacts => f != null);
      if (dryRun) {
        reports.push({ company: company.id, status: "dry_run", inFeed: postings.length, jobs });
        continue;
      }
      const saved = await saveCompanyFeed(company, jobs, at);
      reports.push({ company: company.id, status: "imported", inFeed: postings.length, kept: jobs.length, ...saved });
    } catch (error) {
      reports.push({
        company: company.id,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return reports;
}

/**
 * Takes down the jobs of companies no longer on the list (ADR 0014, 2026-10-17 review). The import reads only the
 * companies on the list, so without this a removed company's approved jobs would show until their last refresh is
 * 2 days old. The demo's made-up companies (`demo-…`, src/mock/external-jobs.ts) are never on the list and stay.
 */
/**
 * The last line of `npm run import:external` (#294): how many companies on the list were read and how many could
 * not be, what changed, and where the new jobs wait. A company stopped or with unchecked terms is on the list but
 * not read; one taken off the list only adds its jobs taken down.
 */
export function importSummary(reports: CompanyReport[]): string {
  const listed = reports.filter((r) => r.status !== "unlisted");
  if (listed.length > 0 && listed.every((r) => r.status === "dry_run")) {
    const kept = listed.reduce((n, r) => n + (r.status === "dry_run" ? r.jobs.length : 0), 0);
    return `Dry run: read ${listed.length} companies, ${kept} jobs would be kept. Nothing was stored.`;
  }
  let read = 0;
  let failed = 0;
  let added = 0;
  let back = 0;
  let down = 0;
  for (const r of reports) {
    if (r.status === "imported") {
      read += 1;
      added += r.added;
      back += r.backToReview;
      down += r.removed;
    } else if (r.status === "failed") failed += 1;
    else if (r.status === "terms_not_checked" || r.status === "unlisted") down += r.takenDown;
  }
  const readPart = `Read ${read} of ${listed.length} companies${failed > 0 ? `, ${failed} could not be read` : ""}`;
  const changes = `${added} new, ${back} back to review, ${down} taken down`;
  const waiting = added + back;
  const where = waiting > 0 ? ` ${waiting} wait for a moderator: /admin, 外部职位.` : "";
  return `${readPart}: ${changes}.${where}`;
}

export async function takeDownUnlisted(listed: ExternalCompany[], now = new Date()): Promise<CompanyReport[]> {
  const onList = new Set(listed.map((c) => c.id));
  const up = (await listExternalJobs()).filter((job) => job.removedAt == null);
  const unlisted = [...new Set(up.map((job) => job.companyId))].filter((id) => !onList.has(id) && !isDemoCompany(id));
  const reports: CompanyReport[] = [];
  for (const company of unlisted) {
    reports.push({ company, status: "unlisted", takenDown: await takeDownCompany(company, now) });
  }
  return reports;
}
