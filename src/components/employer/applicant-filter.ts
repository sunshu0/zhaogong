// 申请人按处理状态筛选 (#192): which applicants show under each pill on a job's 申请人 list, and how many. Pure.
import { decisionLabel, type ApplicationDecision } from "@/components/seeker/applications";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { employerApplicantsMessages } from "@/i18n/messages/employer-applicants";

/** 全部, 未处理 (no mark yet), or one of the marks. */
export type ApplicantFilter = "all" | "open" | ApplicationDecision;

/** The pills in order, in the interface language; the three marks keep the decision's own wording. */
export function applicantFilters(lang: Lang = DEFAULT_LANG): readonly { key: ApplicantFilter; label: string }[] {
  const t = pick(employerApplicantsMessages, lang).applicantFilter;
  return [
    { key: "all", label: t.all },
    { key: "open", label: t.open },
    { key: "fit", label: decisionLabel("fit", lang) },
    { key: "hired", label: decisionLabel("hired", lang) },
    { key: "unfit", label: decisionLabel("unfit", lang) },
  ];
}

export const APPLICANT_FILTERS = applicantFilters();

type Marked = { decision: ApplicationDecision | null };

const matches = (filter: ApplicantFilter, { decision }: Marked) =>
  filter === "all" || (filter === "open" ? decision === null : decision === filter);

/** The applicants under `filter`, in the list's order. */
export function filterApplicants<T extends Marked>(applicants: readonly T[], filter: ApplicantFilter): T[] {
  return applicants.filter((a) => matches(filter, a));
}

/** How many applicants each pill has. */
export function applicantFilterCounts(applicants: readonly Marked[]): Record<ApplicantFilter, number> {
  return Object.fromEntries(
    APPLICANT_FILTERS.map(({ key }) => [key, applicants.filter((a) => matches(key, a)).length]),
  ) as Record<ApplicantFilter, number>;
}
