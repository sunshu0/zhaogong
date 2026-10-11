// Display helpers for job seekers' pages. Pure functions so they can be unit-tested.
import { COUNTRIES } from "@/config/countries";
import type { CountryCode, Job, PayRange } from "@/lib/types";

const DAY_MS = 86_400_000;

/** 25 → "25", 24.5 → "24.50". */
function money(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/** "$25–27/小时", or "$24/小时" for a single rate. */
export function formatPay(pay: PayRange, country: CountryCode): string {
  const symbol = COUNTRIES[country].currencySymbol;
  const range = pay.max != null && pay.max !== pay.min ? `${money(pay.min)}–${money(pay.max)}` : money(pay.min);
  return `${symbol}${range}/小时`;
}

/** "每周 15–25 小时", or undefined when the job does not say. */
export function formatHours(hours: Job["hoursPerWeek"]): string | undefined {
  if (!hours) return undefined;
  const range = hours.max != null && hours.max !== hours.min ? `${hours.min}–${hours.max}` : String(hours.min);
  return `每周 ${range} 小时`;
}

/** Short tags for a job card, most important first. Visa tags state the employer's answer, nothing more. */
export function jobTags(job: Job): string[] {
  const tags: string[] = [];
  if (job.urgent) tags.push("急招");
  if (job.mealsIncluded) tags.push("包餐");
  if (job.accommodationIncluded) tags.push("包住");
  if (job.visaAccepted.includes("student")) tags.push("学签可做");
  return tags;
}

/** "今天" for the first 24 hours, then "x 天前". */
export function postedAgoZh(postedAt: string, now: number): string {
  const days = Math.floor((now - Date.parse(postedAt)) / DAY_MS);
  return days <= 0 ? "今天" : `${days} 天前`;
}
