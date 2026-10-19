// The job list's filters live in the URL so a filtered list can be shared. This module turns a query
// into a JobFilter and back, keeping only values the app knows and writing them in a fixed order.
import { COUNTRIES } from "@/config/countries";
import { JOB_ROLE_IDS, JOB_ROLES } from "@/config/job-roles";
import { EMPLOYMENT_TYPE_LABELS, INDUSTRY_LABELS, VISA_LABELS } from "@/i18n/labels";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { seekerJobsMessages } from "@/i18n/messages/seeker-jobs";
import type { CountryCode, EmploymentType, Industry, JobFilter } from "@/lib/types";

export type SearchParams = Record<string, string | string[] | undefined>;

const QUERY_MAX = 50;

/** Groups URL or form entries by key; repeated keys become arrays. */
export function toParams(source: URLSearchParams | FormData): SearchParams {
  const params: SearchParams = {};
  for (const [key, value] of source.entries()) {
    if (typeof value !== "string") continue;
    const prev = params[key];
    params[key] = prev == null ? value : [...(Array.isArray(prev) ? prev : [prev]), value];
  }
  return params;
}

function all(params: SearchParams, key: string): string[] {
  const raw = params[key];
  return (Array.isArray(raw) ? raw : raw == null ? [] : [raw]).map((v) => v.trim());
}

/** Values of a list filter, comma-separated or repeated, keeping only `known` ones in `known` order. */
function list<T extends string>(params: SearchParams, key: string, known: readonly T[]): T[] | undefined {
  const given = new Set(all(params, key).flatMap((v) => v.split(",")));
  const kept = known.filter((k) => given.has(k));
  return kept.length ? kept : undefined;
}

function first(params: SearchParams, key: string): string | undefined {
  return all(params, key).find((v) => v !== "");
}

function flag(params: SearchParams, key: string): true | undefined {
  const v = first(params, key);
  return v === "1" || v === "true" ? true : undefined;
}

export function parseFilter(params: SearchParams, country: CountryCode): JobFilter {
  const config = COUNTRIES[country];
  const filter: JobFilter = { country };

  const regionIds = list(
    params,
    "region",
    config.regions.map((r) => r.id),
  );
  if (regionIds) filter.regionIds = regionIds;
  const industries = list(params, "industry", Object.keys(INDUSTRY_LABELS) as Industry[]);
  if (industries) filter.industries = industries;
  const roles = list(params, "role", JOB_ROLE_IDS);
  if (roles) filter.roles = roles;
  const employmentTypes = list(params, "type", Object.keys(EMPLOYMENT_TYPE_LABELS) as EmploymentType[]);
  if (employmentTypes) filter.employmentTypes = employmentTypes;

  const minPay = Number(first(params, "minPay"));
  if (Number.isFinite(minPay) && minPay > 0) filter.minPay = minPay;

  const visa = config.visaTypes.find((v) => v === first(params, "visa"));
  if (visa) filter.visa = visa;

  if (flag(params, "meals")) filter.mealsIncluded = true;
  if (flag(params, "housing")) filter.accommodationIncluded = true;

  const query = first(params, "q")?.slice(0, QUERY_MAX);
  if (query) filter.query = query;

  return filter;
}

/** The query string for a filter, without "?"; "" when nothing is filtered. */
export function filterToQuery(filter: JobFilter): string {
  const parts: string[] = [];
  // Ids are plain ASCII, so lists are written as is to keep shared links readable.
  if (filter.regionIds?.length) parts.push(`region=${filter.regionIds.join(",")}`);
  if (filter.industries?.length) parts.push(`industry=${filter.industries.join(",")}`);
  if (filter.roles?.length) parts.push(`role=${filter.roles.join(",")}`);
  if (filter.employmentTypes?.length) parts.push(`type=${filter.employmentTypes.join(",")}`);
  if (filter.minPay != null) parts.push(`minPay=${filter.minPay}`);
  if (filter.visa) parts.push(`visa=${filter.visa}`);
  if (filter.mealsIncluded) parts.push("meals=1");
  if (filter.accommodationIncluded) parts.push("housing=1");
  if (filter.query) parts.push(`q=${encodeURIComponent(filter.query)}`);
  return parts.join("&");
}

/**
 * The names of the filters a search used, comma-separated in the query's order ("region,meals,q"): jobs_search's
 * detail (#319, ADR 0025). Names only, never their values or the words searched; the names are catalog.ts's
 * FILTER_NAMES, as the query's keys are.
 */
export function usedFilterNames(filter: JobFilter): string {
  return [...new URLSearchParams(filterToQuery(filter)).keys()].join(",");
}

/** The job list's URL for a query from filterToQuery. */
export function jobsHref(query: string): string {
  return query ? `/jobs?${query}` : "/jobs";
}

export interface FilterChip {
  id: string;
  label: string;
  /** Query for the same list without this chip. */
  query: string;
}

/** One chip per active filter value, in the order they appear in the query, in the page's language. */
export function filterChips(filter: JobFilter, lang: Lang = DEFAULT_LANG): FilterChip[] {
  const t = pick(seekerJobsMessages, lang);
  const symbol = COUNTRIES[filter.country].currencySymbol;
  const chips: FilterChip[] = [];
  const add = (id: string, label: string, without: Partial<JobFilter>) =>
    chips.push({ id, label, query: filterToQuery({ ...filter, ...without }) });
  const drop = <T>(values: T[], value: T) => values.filter((v) => v !== value);

  const regions = COUNTRIES[filter.country].regions;
  for (const id of filter.regionIds ?? [])
    add(
      `region:${id}`,
      regionName(
        regions.find((r) => r.id === id),
        lang,
      ) ?? id,
      {
        regionIds: drop(filter.regionIds!, id),
      },
    );
  for (const id of filter.industries ?? [])
    add(`industry:${id}`, INDUSTRY_LABELS[id][lang], { industries: drop(filter.industries!, id) });
  for (const id of filter.roles ?? []) add(`role:${id}`, JOB_ROLES[id][lang], { roles: drop(filter.roles!, id) });
  for (const id of filter.employmentTypes ?? [])
    add(`type:${id}`, EMPLOYMENT_TYPE_LABELS[id][lang], { employmentTypes: drop(filter.employmentTypes!, id) });
  if (filter.minPay != null) add("minPay", t.pay.minPayChip(`${symbol}${filter.minPay}`), { minPay: undefined });
  if (filter.visa) add("visa", t.filter.visaChip(VISA_LABELS[filter.visa][lang]), { visa: undefined });
  if (filter.mealsIncluded) add("meals", t.filter.meals, { mealsIncluded: undefined });
  if (filter.accommodationIncluded) add("housing", t.filter.housing, { accommodationIncluded: undefined });
  if (filter.query) add("q", t.filter.queryChip(filter.query), { query: undefined });
  return chips;
}

/** The filter panel's groups, each a row that opens to show its choices (#63). */
export type FilterGroup = "region" | "industry" | "role" | "type" | "minPay" | "visa" | "food";

/**
 * What a closed group shows after its name: the one choice made in it (「Albany」「$30 起」), 「已选 N」 for several,
 * or undefined when nothing in it is chosen.
 */
export function filterGroupSummary(
  filter: JobFilter,
  group: FilterGroup,
  lang: Lang = DEFAULT_LANG,
): string | undefined {
  const t = pick(seekerJobsMessages, lang);
  if (group === "minPay")
    return filter.minPay == null
      ? undefined
      : t.pay.from(`${COUNTRIES[filter.country].currencySymbol}${filter.minPay}`);
  if (group === "visa") return filter.visa && VISA_LABELS[filter.visa][lang];
  const ids = group === "food" ? ["meals", "housing"] : null;
  const chips = filterChips(filter, lang).filter((c) => (ids ? ids.includes(c.id) : c.id.startsWith(`${group}:`)));
  if (chips.length === 0) return undefined;
  return chips.length === 1 ? chips[0].label : t.filter.chosen(chips.length);
}

/** A region's name in the language (the English names are mostly the same). */
function regionName(region: { nameZh: string; nameEn: string } | undefined, lang: Lang): string | undefined {
  return region && (lang === "en" ? region.nameEn : region.nameZh);
}

export function isFiltered(filter: JobFilter): boolean {
  return filterChips(filter).length > 0;
}
