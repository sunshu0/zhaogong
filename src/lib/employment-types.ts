import { EMPLOYMENT_TYPE_LABELS } from "@/i18n/labels";
import type { EmploymentType, Job } from "@/lib/types";

export function employmentTypes(value?: Job["employmentType"]): EmploymentType[] {
  return value == null ? [] : Array.isArray(value) ? value : [value];
}

/** Keep existing single-type drafts compatible while representing multiple selections together. */
export function packEmploymentTypes(types: EmploymentType[]): Job["employmentType"] | undefined {
  const unique = [...new Set(types)];
  return unique.length > 1 ? unique : unique[0];
}

export function formatEmploymentTypes(value?: Job["employmentType"], language: "zh" | "en" = "zh"): string {
  return employmentTypes(value).map((type) => EMPLOYMENT_TYPE_LABELS[type][language]).join(" / ");
}
