// Filters of the 实习 and 专业职位 sections (#113). Pure: the pages parse the address's query into a filter and
// apply it to the jobs the sections may show. Every option filters on what the posting states; 「原文未说明」 is
// an option of its own, never folded into another.
import { externalMessages } from "@/i18n/messages/external";
import { sectionOf } from "@/lib/external-jobs/visibility";
import type { ExternalCity, ExternalFacts, ExternalField, ExternalKind } from "@/lib/external-jobs/types";

export type ExternalSection = "internship" | "professional";

export const SECTION_PATHS: Record<ExternalSection, string> = {
  internship: "/internships",
  professional: "/professional",
};
/** The sections' names in Chinese (the external dictionary's `sections` for the page's language). */
export const SECTION_TITLES: Record<ExternalSection, string> = {
  internship: externalMessages.zh.sections.internship,
  professional: externalMessages.zh.sections.professional,
};

export const SECTION_KINDS: Record<ExternalSection, ExternalKind[]> = {
  internship: ["internship", "graduate"],
  professional: ["full_time", "part_time", "contract"],
};

/** The filters' options in Chinese (the external dictionary's `filter` for the page's language). */
export const EXPERIENCE_OPTIONS = externalMessages.zh.filter.experienceOptions;
export const VISA_OPTIONS = externalMessages.zh.filter.visaOptions;

export interface ExternalFilter {
  field?: ExternalField;
  /** A kind of the section, or "unstated". */
  kind?: ExternalKind | "unstated";
  experience?: keyof typeof EXPERIENCE_OPTIONS;
  visa?: keyof typeof VISA_OPTIONS;
  city?: ExternalCity;
  /** Only jobs whose posting states the pay. */
  paid?: boolean;
}

type Query = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const pick = <T extends string>(v: string | undefined, allowed: readonly T[]) =>
  allowed.includes(v as T) ? (v as T) : undefined;

const CITIES: ExternalCity[] = ["auckland", "wellington", "christchurch", "hamilton", "dunedin", "nz_other"];

/** The filter in the address; anything unknown is ignored. */
export function parseExternalFilter(query: Query, section: ExternalSection): ExternalFilter {
  const filter: ExternalFilter = {
    field: pick(one(query.field), ["software", "electrical"] as const),
    kind: pick(one(query.kind), [...SECTION_KINDS[section], "unstated" as const]),
    experience: pick(one(query.experience), Object.keys(EXPERIENCE_OPTIONS) as (keyof typeof EXPERIENCE_OPTIONS)[]),
    visa: pick(one(query.visa), Object.keys(VISA_OPTIONS) as (keyof typeof VISA_OPTIONS)[]),
    city: pick(one(query.city), CITIES),
    paid: one(query.paid) === "1" || undefined,
  };
  return Object.fromEntries(Object.entries(filter).filter(([, v]) => v !== undefined)) as ExternalFilter;
}

export const isExternalFiltered = (filter: ExternalFilter) => Object.keys(filter).length > 0;

type Filterable = Pick<ExternalFacts, "field" | "kind" | "minYears" | "visa" | "city" | "pay">;

/** The jobs of the section that match the filter, in the order given. */
export function filterExternalJobs<T extends Filterable>(
  jobs: T[],
  section: ExternalSection,
  filter: ExternalFilter,
): T[] {
  return jobs.filter((job) => {
    // Jobs that do not say their kind belong to 专业职位 (sectionOf), where 「原文未说明」 can pick them out.
    if (sectionOf(job.kind) !== section) return false;
    if (filter.field && job.field !== filter.field) return false;
    if (filter.kind && (filter.kind === "unstated" ? job.kind != null : job.kind !== filter.kind)) return false;
    if (filter.experience === "unstated" && job.minYears != null) return false;
    if (filter.experience === "le2" && (job.minYears == null || job.minYears > 2)) return false;
    if (filter.experience === "ge3" && (job.minYears == null || job.minYears < 3)) return false;
    if (filter.visa === "unstated" && job.visa.length > 0) return false;
    if (filter.visa === "sponsorship" && !job.visa.includes("sponsorship")) return false;
    if (filter.visa === "required" && !job.visa.some((v) => v === "citizen_or_resident" || v === "work_rights"))
      return false;
    if (filter.city && job.city !== filter.city) return false;
    if (filter.paid && !job.pay) return false;
    return true;
  });
}
