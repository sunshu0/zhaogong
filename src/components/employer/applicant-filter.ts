// 申请人按处理状态筛选 (#192): which applicants show under each pill on a job's 申请人 list, and how many. Pure.
import { DECISION_LABELS, type ApplicationDecision } from "@/components/seeker/applications";

/** 全部, 未处理 (no mark yet), or one of the marks. */
export type ApplicantFilter = "all" | "open" | ApplicationDecision;

export const APPLICANT_FILTERS: readonly { key: ApplicantFilter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "open", label: "未处理" },
  { key: "fit", label: DECISION_LABELS.fit },
  { key: "hired", label: DECISION_LABELS.hired },
  { key: "unfit", label: DECISION_LABELS.unfit },
];

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
