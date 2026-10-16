// 职位提醒 for the 实习 and 专业职位 sections (#131, ADR 0020). Pure, for the server and the pages alike. An alert on a
// section is the section's filter kept as its query string, as an alert on the job list is (#53), plus the section.
import { ALERT_NAME_MAX } from "@/components/seeker/job-alerts";
import {
  EXPERIENCE_OPTIONS,
  parseExternalFilter,
  SECTION_PATHS,
  SECTION_TITLES,
  VISA_OPTIONS,
  type ExternalFilter,
  type ExternalSection,
} from "@/lib/external-jobs/filter";
import { CITY_LABELS, FIELD_LABELS, KIND_LABELS, NOT_STATED } from "@/lib/external-jobs/labels";

export const EXTERNAL_SECTIONS: ExternalSection[] = ["internship", "professional"];

export function parseSection(value: unknown): ExternalSection | undefined {
  return EXTERNAL_SECTIONS.find((section) => section === value);
}

/** The filter as a query string, its keys in one order, so the same search is recognised twice. */
export function externalFilterToQuery(filter: ExternalFilter): string {
  const params = new URLSearchParams();
  for (const key of ["field", "kind", "experience", "visa", "city"] as const) {
    const value = filter[key];
    if (value) params.set(key, value);
  }
  if (filter.paid) params.set("paid", "1");
  return params.toString();
}

/** The filter a stored query stands for. Values the section does not know drop out, as they do from a link. */
export function externalAlertFilter(alert: { section: ExternalSection; query: string }): ExternalFilter {
  return parseExternalFilter(Object.fromEntries(new URLSearchParams(alert.query)), alert.section);
}

/** A query from the browser in the one form alerts are stored in. */
export function normalizeExternalQuery(query: unknown, section: ExternalSection): string {
  const raw = typeof query === "string" ? query.slice(0, 500) : "";
  return externalFilterToQuery(externalAlertFilter({ section, query: raw }));
}

/** The section's list with the alert's filter. */
export function externalAlertHref(alert: { section: ExternalSection; query: string }): string {
  return alert.query ? `${SECTION_PATHS[alert.section]}?${alert.query}` : SECTION_PATHS[alert.section];
}

/** The conditions in words, in the order of the filter form; empty for every new job of the section. */
export function externalAlertConditions(alert: { section: ExternalSection; query: string }): string[] {
  const f = externalAlertFilter(alert);
  return [
    f.field && FIELD_LABELS[f.field],
    f.kind && (f.kind === "unstated" ? `类型${NOT_STATED}` : KIND_LABELS[f.kind]),
    f.experience && `经验：${EXPERIENCE_OPTIONS[f.experience]}`,
    f.visa && `签证：${VISA_OPTIONS[f.visa]}`,
    f.city && CITY_LABELS[f.city],
    f.paid && "写了薪资",
  ].filter((label): label is string => Boolean(label));
}

/** The name an alert on a section starts with: the section, then its conditions, shortened to fit. */
export function defaultExternalAlertName(alert: { section: ExternalSection; query: string }): string {
  const title = SECTION_TITLES[alert.section];
  const conditions = externalAlertConditions(alert);
  const name = conditions.length ? `${title}：${conditions.join("、")}` : `全部${title}`;
  return name.length > ALERT_NAME_MAX ? `${name.slice(0, ALERT_NAME_MAX - 1)}…` : name;
}

/** An external job found by an alert: one notification per account and job, apart from the job list's (alert:<id>). */
export function externalAlertNotificationId(externalJobId: string): string {
  return `alert:external:${externalJobId}`;
}
