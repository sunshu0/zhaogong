// Shapes used by the post flow: the editable form, the draft the checks read, and the job that
// gets published. Pure functions, unit-tested; the server re-sanitizes whatever the browser sends.
import { COUNTRIES } from "@/config/countries";
import type { JobDraft } from "@/lib/compliance";
import { missingFields } from "@/lib/ai-post";
import type { CountryCode, Industry, Job, LanguageRequirement, VisaAccepted } from "@/lib/types";
import { INDUSTRY_LABELS, LANGUAGE_LABELS, VISA_LABELS } from "@/i18n/labels";
import { JOB_LIFETIME_DAYS } from "@/components/employer/job-status";
import { normalizeEmploymentTypes } from "@/lib/employment-types";
import { parseJobRoles, suggestJobRoles } from "@/lib/job-roles";

/** What the form edits. Text is kept as typed; numbers are undefined while empty. */
export interface PostForm {
  titleZh: string;
  titleEn: string;
  industry?: Industry;
  employmentType?: Job["employmentType"];
  regionId?: string;
  address: string;
  payMin?: number;
  payMax?: number;
  hoursMin?: number;
  hoursMax?: number;
  shiftsZh: string;
  mealsIncluded: boolean;
  accommodationIncluded: boolean;
  urgent: boolean;
  visaAccepted: VisaAccepted[];
  languages: LanguageRequirement[];
  descriptionZh: string;
  descriptionEn: string;
  /** Show the details below to signed-in job seekers; otherwise they are swapped in chat. */
  contactPublic: boolean;
  /** Kept while the employer switches the choice back and forth; only a public job stores them. */
  phone: string;
  wechat: string;
  email: string;
}

export function emptyForm(): PostForm {
  return {
    titleZh: "",
    titleEn: "",
    address: "",
    shiftsZh: "",
    mealsIncluded: false,
    accommodationIncluded: false,
    urgent: false,
    visaAccepted: [],
    languages: [],
    descriptionZh: "",
    descriptionEn: "",
    contactPublic: false,
    phone: "",
    wechat: "",
    email: "",
  };
}

export function formFromDraft(draft: JobDraft): PostForm {
  return {
    ...emptyForm(),
    titleZh: draft.titleZh ?? "",
    titleEn: draft.titleEn ?? "",
    industry: draft.industry,
    employmentType: draft.employmentType,
    regionId: draft.regionId,
    address: draft.address ?? "",
    payMin: draft.pay?.min,
    payMax: draft.pay?.max,
    hoursMin: draft.hoursPerWeek?.min,
    hoursMax: draft.hoursPerWeek?.max,
    shiftsZh: draft.shiftsZh ?? "",
    mealsIncluded: draft.mealsIncluded ?? false,
    accommodationIncluded: draft.accommodationIncluded ?? false,
    urgent: draft.urgent ?? false,
    visaAccepted: draft.visaAccepted ?? [],
    languages: draft.languages ?? [],
    descriptionZh: draft.descriptionZh ?? "",
    descriptionEn: draft.descriptionEn ?? "",
    contactPublic: draft.contactPublic ?? false,
    phone: draft.contact?.phone ?? "",
    wechat: draft.contact?.wechat ?? "",
    email: draft.contact?.email ?? "",
  };
}

const text = (s: string) => s.trim() || undefined;
const range = (min?: number, max?: number) =>
  min == null || Number.isNaN(min)
    ? undefined
    : max != null && !Number.isNaN(max) && max > min
      ? { min, max }
      : { min };

export function draftFromForm(form: PostForm, country: CountryCode): JobDraft {
  const draft: JobDraft = {
    country,
    titleZh: text(form.titleZh),
    titleEn: text(form.titleEn),
    industry: form.industry,
    employmentType: form.employmentType,
    regionId: form.regionId,
    address: text(form.address),
    pay: range(form.payMin, form.payMax),
    hoursPerWeek: range(form.hoursMin, form.hoursMax),
    shiftsZh: text(form.shiftsZh),
    mealsIncluded: form.mealsIncluded,
    accommodationIncluded: form.accommodationIncluded,
    urgent: form.urgent,
    visaAccepted: form.visaAccepted,
    languages: form.languages,
    descriptionZh: text(form.descriptionZh),
    descriptionEn: text(form.descriptionEn),
    contactPublic: form.contactPublic,
    contact: form.contactPublic
      ? {
          ...(text(form.phone) && { phone: text(form.phone) }),
          ...(text(form.wechat) && { wechat: text(form.wechat) }),
          ...(text(form.email) && { email: text(form.email) }),
        }
      : {},
  };
  for (const key of Object.keys(draft) as (keyof JobDraft)[]) if (draft[key] === undefined) delete draft[key];
  return draft;
}

/** The job to publish, or undefined while a required field is missing. */
export function completeJob(
  draft: JobDraft,
  employerId: string,
  now: number,
  status: Job["status"],
): Omit<Job, "id"> | undefined {
  if (missingFields(draft).length) return undefined;
  return {
    country: draft.country!,
    employerId,
    titleZh: draft.titleZh!,
    titleEn: draft.titleEn!,
    industry: draft.industry!,
    // 岗位类别 (#96): the employer's choice, else what the title names; none is 待选.
    roles: draft.roles?.length ? draft.roles : suggestJobRoles({ ...draft, industry: draft.industry! }),
    employmentType: draft.employmentType!,
    regionId: draft.regionId!,
    ...(draft.address && { address: draft.address }),
    pay: draft.pay!,
    ...(draft.hoursPerWeek && { hoursPerWeek: draft.hoursPerWeek }),
    ...(draft.shiftsZh && { shiftsZh: draft.shiftsZh }),
    mealsIncluded: draft.mealsIncluded ?? false,
    accommodationIncluded: draft.accommodationIncluded ?? false,
    visaAccepted: draft.visaAccepted!,
    languages: draft.languages ?? [],
    descriptionZh: draft.descriptionZh!,
    descriptionEn: draft.descriptionEn!,
    contactPublic: draft.contactPublic ?? false,
    // A private job keeps no contact details: they are swapped in chat once both sides agree.
    contact: draft.contactPublic ? draft.contact! : {},
    status,
    postedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + JOB_LIFETIME_DAYS * 86_400_000).toISOString(),
    urgent: draft.urgent ?? false,
  };
}

/** What an employer's edit may change. Dates, owner, market and status are not in the form. */
const EDITABLE_FIELDS = [
  "titleZh",
  "titleEn",
  "industry",
  "roles",
  "employmentType",
  "regionId",
  "address",
  "pay",
  "hoursPerWeek",
  "shiftsZh",
  "mealsIncluded",
  "accommodationIncluded",
  "visaAccepted",
  "languages",
  "descriptionZh",
  "descriptionEn",
  "contactPublic",
  "contact",
  "urgent",
] as const satisfies readonly (keyof Job)[];

/** The edited fields as a patch; optional fields left empty in the form are cleared (undefined). */
export function editPatch(job: Omit<Job, "id">): Pick<Job, (typeof EDITABLE_FIELDS)[number]> {
  return Object.fromEntries(EDITABLE_FIELDS.map((k) => [k, job[k]])) as Pick<Job, (typeof EDITABLE_FIELDS)[number]>;
}

// ---- server side: never trust the shape of what a Server Function receives ----

const LIMITS = { short: 80, address: 120, contact: 60, long: 3000 };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v != null && !Array.isArray(v);
const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.slice(0, max) : undefined);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 10_000 ? v : undefined);
const bool = (v: unknown) => (typeof v === "boolean" ? v : undefined);
const oneOf = <T extends string>(v: unknown, allowed: readonly T[]) =>
  allowed.includes(v as T) ? (v as T) : undefined;
const listOf = <T extends string>(v: unknown, allowed: readonly T[]) =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is T => allowed.includes(x as T)))] : undefined;
const nonEmpty = <T>(list: T[]) => (list.length ? list : undefined);
const numRange = (v: unknown) => {
  if (!isObject(v) || num(v.min) == null) return undefined;
  const min = num(v.min)!;
  const max = num(v.max);
  return max != null && max > min ? { min, max } : { min };
};

const INDUSTRIES = Object.keys(INDUSTRY_LABELS) as Industry[];
const VISAS = Object.keys(VISA_LABELS) as VisaAccepted[];
const LANGUAGES = Object.keys(LANGUAGE_LABELS) as LanguageRequirement[];

export function sanitizeDraft(input: unknown, country: CountryCode): JobDraft {
  if (!isObject(input)) return { country };
  const regions = COUNTRIES[country].regions.map((r) => r.id);
  const contact = isObject(input.contact) ? input.contact : undefined;
  const draft: JobDraft = {
    country,
    titleZh: str(input.titleZh, LIMITS.short),
    titleEn: str(input.titleEn, LIMITS.short),
    industry: oneOf(input.industry, INDUSTRIES),
    roles: nonEmpty(parseJobRoles(input.roles)),
    employmentType: nonEmpty(normalizeEmploymentTypes(input.employmentType)),
    regionId: oneOf(input.regionId, regions),
    address: str(input.address, LIMITS.address),
    pay: numRange(input.pay),
    hoursPerWeek: numRange(input.hoursPerWeek),
    shiftsZh: str(input.shiftsZh, LIMITS.short),
    mealsIncluded: bool(input.mealsIncluded),
    accommodationIncluded: bool(input.accommodationIncluded),
    urgent: bool(input.urgent),
    contactPublic: bool(input.contactPublic),
    visaAccepted: listOf(input.visaAccepted, VISAS),
    languages: listOf(input.languages, LANGUAGES),
    descriptionZh: str(input.descriptionZh, LIMITS.long),
    descriptionEn: str(input.descriptionEn, LIMITS.long),
    contact: contact && {
      ...(str(contact.phone, LIMITS.contact) && { phone: str(contact.phone, LIMITS.contact) }),
      ...(str(contact.wechat, LIMITS.contact) && { wechat: str(contact.wechat, LIMITS.contact) }),
      ...(str(contact.email, LIMITS.contact) && { email: str(contact.email, LIMITS.contact) }),
    },
  };
  for (const key of Object.keys(draft) as (keyof JobDraft)[]) if (draft[key] === undefined) delete draft[key];
  return draft;
}
