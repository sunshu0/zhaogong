// One import of external jobs (#111, ADR 0014): for each company on the list, read its public feed politely, keep
// the facts of the software and electrical jobs in New Zealand, and store them. A company whose terms nobody has
// checked is not read at all, and anything it had comes down. A feed that cannot be read leaves the company's jobs
// as they were; they stop showing on their own once their last refresh is 2 days old. Server only.
import { importAllowed, type ExternalCompany } from "@/config/external-companies";
import { saveCompanyFeed, takeDownCompany, type FeedResult } from "@/db/external-jobs";
import { factsOf } from "@/lib/external-jobs/facts";
import { parsePostings, postingsUrl } from "@/lib/external-jobs/sources";
import type { ExternalFacts } from "@/lib/external-jobs/types";

export type CompanyReport =
  | { company: string; status: "terms_not_checked"; takenDown: number }
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
  for (const company of companies) {
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
