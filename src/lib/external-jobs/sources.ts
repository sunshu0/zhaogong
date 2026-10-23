// The applicant-tracking systems the importer reads (#111, ADR 0014; Ashby #138), through the APIs they publish for
// public job boards; no key, no sign-in, no HTML pages. Each adapter gives the URL to read and turns the answer into
// RawPostings. Pure: the fetching is in polite-fetch.ts.
import { decodeEntities, htmlToText } from "@/lib/external-jobs/facts";
import type { ExternalPay, ExternalSource, PayPeriod, RawPosting } from "@/lib/external-jobs/types";

/**
 * Whether a posting's link is a web address (security review J): an absolute http: or https: URL. Anything else
 * (javascript:, data:, a link without its scheme) leaves the posting out, as Ashby's unlisted ones are: the job page's
 * 去官网申请 is its only way to apply. The link is stored as the feed gave it.
 */
export function isWebLink(url: unknown): boolean {
  if (typeof url !== "string") return false;
  try {
    return ["http:", "https:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

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
  return jobs
    .filter((job) => isWebLink(job.absolute_url))
    .map((job) => ({
      externalId: String(job.id),
      source: "greenhouse",
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
  return (body as LeverPosting[])
    .filter((p) => isWebLink(p.hostedUrl))
    .map((p) => {
      const c = p.categories ?? {};
      const locations = [c.location, ...(c.allLocations ?? [])].filter((n): n is string => Boolean(n));
      const lists = (p.lists ?? []).map((l) => `${l.text ?? ""}\n${htmlToText(l.content ?? "")}`);
      return {
        externalId: p.id,
        source: "lever",
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

// ---- Ashby Job Postings API: https://developers.ashbyhq.com/docs/public-job-posting-api (#138) ----

type AshbyPostal = { addressLocality?: string; addressRegion?: string; addressCountry?: string };
/** The job's address wraps it in postalAddress; a secondary location's address is the postal address itself. */
type AshbyAddress = { postalAddress?: AshbyPostal } | AshbyPostal;

interface AshbyJob {
  id: string;
  title: string;
  department?: string;
  team?: string;
  employmentType?: string;
  location?: string;
  secondaryLocations?: { location?: string; address?: AshbyAddress }[];
  address?: AshbyAddress;
  publishedAt?: string;
  /** False: the company shows it only by direct link, so it is not listed elsewhere either. */
  isListed?: boolean;
  jobUrl: string;
  descriptionPlain?: string;
  compensation?: {
    summaryComponents?: {
      compensationType?: string;
      interval?: string;
      currencyCode?: string | null;
      minValue?: number | null;
      maxValue?: number | null;
    }[];
  } | null;
}

const postal = (address?: AshbyAddress): AshbyPostal | undefined =>
  address && "postalAddress" in address ? address.postalAddress : (address as AshbyPostal | undefined);

/** An Ashby address as place names, city first. */
function ashbyPlaces(address?: AshbyAddress): string[] {
  const a = postal(address);
  return [a?.addressLocality, a?.addressRegion, a?.addressCountry].filter((n): n is string => Boolean(n));
}

function ashbyPay(job: AshbyJob): ExternalPay | undefined {
  const salary = job.compensation?.summaryComponents?.find((c) => c.compensationType === "Salary");
  if (!salary?.minValue || !(salary.minValue > 0) || !salary.currencyCode) return undefined;
  const period: PayPeriod = /hour/i.test(salary.interval ?? "")
    ? "hour"
    : /month/i.test(salary.interval ?? "")
      ? "month"
      : "year";
  return {
    minCents: Math.round(salary.minValue * 100),
    ...(salary.maxValue && salary.maxValue > salary.minValue && { maxCents: Math.round(salary.maxValue * 100) }),
    currency: salary.currencyCode,
    period,
  };
}

export function parseAshby(body: unknown): RawPosting[] {
  const jobs = (body as { jobs?: AshbyJob[] })?.jobs;
  if (!Array.isArray(jobs)) throw new Error("Ashby answer has no jobs list");
  return (
    jobs
      // Ashby: a posting not listed "should only be available via direct link".
      .filter((job) => job.isListed !== false && isWebLink(job.jobUrl))
      .map((job) => {
        const secondary = job.secondaryLocations ?? [];
        const countries = [job.address, ...secondary.map((s) => s.address)]
          .map((a) => postal(a)?.addressCountry?.trim())
          .filter((c): c is string => Boolean(c));
        const onlyNz = countries.length > 0 && countries.every((c) => /^(new zealand|nz|aotearoa)$/i.test(c));
        const locations = [
          job.location,
          ...ashbyPlaces(job.address),
          ...secondary.flatMap((s) => [s.location, ...ashbyPlaces(s.address)]),
        ].filter((n): n is string => Boolean(n));
        return {
          externalId: job.id,
          source: "ashby",
          title: job.title,
          locations: [...new Set(locations)],
          ...(onlyNz && { country: "NZ" }),
          departments: [job.department, job.team].filter((n): n is string => Boolean(n)),
          ...(job.employmentType && { commitment: job.employmentType }),
          url: job.jobUrl,
          ...(job.publishedAt && { postedAt: new Date(job.publishedAt).toISOString() }),
          ...(ashbyPay(job) && { pay: ashbyPay(job) }),
          text: job.descriptionPlain ?? "",
        };
      })
  );
}

// ---- all ----

/**
 * Where a company's public postings are read. `board` is the board token (Greenhouse), site name (Lever) or job board
 * name (Ashby).
 */
export function postingsUrl(source: ExternalSource, board: string): string {
  const b = encodeURIComponent(board);
  switch (source) {
    case "greenhouse":
      return `https://boards-api.greenhouse.io/v1/boards/${b}/jobs?content=true&pay_transparency=true`;
    case "lever":
      return `https://api.lever.co/v0/postings/${b}?mode=json`;
    case "ashby":
      return `https://api.ashbyhq.com/posting-api/job-board/${b}?includeCompensation=true`;
  }
}

export function parsePostings(source: ExternalSource, body: unknown): RawPosting[] {
  switch (source) {
    case "greenhouse":
      return parseGreenhouse(body);
    case "lever":
      return parseLever(body);
    case "ashby":
      return parseAshby(body);
  }
}
