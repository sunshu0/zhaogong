import { EMPLOYMENT_TYPE_LABELS } from "@/i18n/labels";
import type { EmploymentType } from "@/lib/types";

const ALL_TYPES = Object.keys(EMPLOYMENT_TYPE_LABELS) as EmploymentType[];

/**
 * Whatever arrives (one type from an older draft, a list from the form, junk from the browser) as a
 * clean list: known types only, each once, in the usual order.
 */
export function normalizeEmploymentTypes(value: unknown): EmploymentType[] {
  const given: unknown[] = Array.isArray(value) ? value : [value];
  return ALL_TYPES.filter((type) => given.includes(type));
}

export function formatEmploymentTypes(value: readonly EmploymentType[] = [], language: "zh" | "en" = "zh"): string {
  return value.map((type) => EMPLOYMENT_TYPE_LABELS[type][language]).join(" / ");
}
