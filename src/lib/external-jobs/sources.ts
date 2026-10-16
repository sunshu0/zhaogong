// The two applicant-tracking systems the importer reads (#111, ADR 0014), through the APIs they publish for public
// job boards; no key, no sign-in, no HTML pages. Each adapter gives the URL to read and turns the answer into
// RawPostings. Pure: the fetching is in polite-fetch.ts.
import { decodeEntities, htmlToText } from "@/lib/external-jobs/facts";
import type { ExternalPay, ExternalSource, PayPeriod, RawPosting } from "@/lib/external-jobs/types";

// ---- Greenhouse Job Board API: https://developers.greenhouse.io/job-board.html ----

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  location?: { name?: string } | null;
  offices?: { name?: string; location?: string | null }[];
  departments?: { name?: string }[];
  first_published?: string | null;
  application_deadline?: string | null;
  /** The posting's HTML, escaped once more. */
  content?: string;
  pay_input_ranges?: { min_cents: number; max_cents: number; currency_type: string; title?: string }[];
}

function greenhousePay(job: GreenhouseJob): ExternalPay | undefined {
  const range = job.pay_input_ranges?.[0];
  if (!range || !(range.min_cents > 0)) return undefined;
  const period: PayPeriod = /hour/i.test(range.title ?? "") ? "hour" : "year";
  return {
    minCents: range.min_cents,
    ...(range.max_cents > range.min_cents && { maxCents: range.max_cents }),
    currency: range.currency_type || "NZD",
    period,
  };
}

export function parseGreenhouse(body: unknown): RawPosting[] {
  const jobs = (body as { jobs?: GreenhouseJob[] })?.jobs;
  if (!Array.isArray(jobs)) throw new Error("Greenhouse answer has no jobs list");
  return jobs.map((job) => ({
    externalId: String(job.id),
    title: job.title,
    locations: [job.location?.name, ...(job.offices ?? []).flatMap((o) => [o.location, o.name])].filter(
      (n): n is string => Boolean(n),
    ),
    departments: (job.departments ?? []).map((d) => d.name ?? "").filter(Boolean),
    url: job.absolute_url,
    ...(job.first_published && { postedAt: new Date(job.first_published).toISOString() }),
    ...(job.application_deadline && { deadline: job.application_deadline }),
    ...(greenhousePay(job) && { pay: greenhousePay(job) }),
    text: htmlToText(decodeEntities(job.content ?? "")),
  }));
}

// ---- Lever Postings API: https://github.com/lever/postings-api ----

interface LeverPosting {
  id: string;
  text: string;
  hostedUrl: string;
  createdAt?: number;
  country?: string | null;
  categories?: { commitment?: string; department?: string; team?: string; location?: string; allLocations?: string[] };
  descriptionPlain?: string;
  lists?: { text?: string; content?: string }[];
  additionalPlain?: string;
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string } | null;
}

function leverPay(p: LeverPosting): ExternalPay | undefined {
  const r = p.salaryRange;
  if (!r?.min || !(r.min > 0)) return undefined;
  const period: PayPeriod = /hour/i.test(r.interval ?? "")
    ? "hour"
    : /month/i.test(r.interval ?? "")
      ? "month"
      : "year";
  return {
    minCents: Math.round(r.min * 100),
    ...(r.max && r.max > r.min && { maxCents: Math.round(r.max * 100) }),
    currency: r.currency || "NZD",
    period,
  };
}

export function parseLever(body: unknown): RawPosting[] {
  if (!Array.isArray(body)) throw new Error("Lever answer is not a list of postings");
  return (body as LeverPosting[]).map((p) => {
    const c = p.categories ?? {};
    const locations = [c.location, ...(c.allLocations ?? [])].filter((n): n is string => Boolean(n));
    const lists = (p.lists ?? []).map((l) => `${l.text ?? ""}\n${htmlToText(l.content ?? "")}`);
    return {
      externalId: p.id,
      title: p.text,
      locations: [...new Set(locations)],
      ...(p.country && { country: p.country }),
      departments: [c.department, c.team].filter((n): n is string => Boolean(n)),
      ...(c.commitment && { commitment: c.commitment }),
      url: p.hostedUrl,
      ...(p.createdAt && { postedAt: new Date(p.createdAt).toISOString() }),
      ...(leverPay(p) && { pay: leverPay(p) }),
      text: [p.descriptionPlain ?? "", ...lists, p.additionalPlain ?? ""].join("\n"),
    };
  });
}

// ---- both ----

/** Where a company's public postings are read. `board` is the board token (Greenhouse) or site name (Lever). */
export function postingsUrl(source: ExternalSource, board: string): string {
  const b = encodeURIComponent(board);
  return source === "greenhouse"
    ? `https://boards-api.greenhouse.io/v1/boards/${b}/jobs?content=true&pay_transparency=true`
    : `https://api.lever.co/v0/postings/${b}?mode=json`;
}

export function parsePostings(source: ExternalSource, body: unknown): RawPosting[] {
  return source === "greenhouse" ? parseGreenhouse(body) : parseLever(body);
}
