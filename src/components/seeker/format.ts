// Display helpers for job seekers' pages. Pure functions so they can be unit-tested. Round 20: each takes the page's
// language (Chinese by default); the words come from the seeker-jobs dictionary and the figures from i18n/format.
import { COUNTRIES } from "@/config/countries";
import { formatAmount } from "@/i18n/format";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { seekerJobsMessages } from "@/i18n/messages/seeker-jobs";
import type { CountryCode, Job, PayRange } from "@/lib/types";

export const DAY_MS = 86_400_000;

/** 25 → "25", 24.5 → "24.50". */
export function formatMoney(n: number, lang: Lang = DEFAULT_LANG): string {
  return formatAmount(n, lang);
}

/** The amount with its symbol: "$25–27", or "$24" for a single rate. */
export function payAmount(pay: PayRange, country: CountryCode, lang: Lang = DEFAULT_LANG): string {
  const symbol = COUNTRIES[country].currencySymbol;
  const range =
    pay.max != null && pay.max !== pay.min
      ? pick(seekerJobsMessages, lang).pay.range(formatMoney(pay.min, lang), formatMoney(pay.max, lang))
      : formatMoney(pay.min, lang);
  return `${symbol}${range}`;
}

/** "$25–27/小时" / "$25–27 an hour", or "$24/小时" for a single rate. */
export function formatPay(pay: PayRange, country: CountryCode, lang: Lang = DEFAULT_LANG): string {
  return pick(seekerJobsMessages, lang).pay.perHour(payAmount(pay, country, lang));
}

/** "每周 15–25 小时" / "15–25 hours a week", or undefined when the job does not say. */
export function formatHours(hours: Job["hoursPerWeek"], lang: Lang = DEFAULT_LANG): string | undefined {
  if (!hours) return undefined;
  const range = hours.max != null && hours.max !== hours.min ? `${hours.min}–${hours.max}` : String(hours.min);
  return pick(seekerJobsMessages, lang).hours.perWeek(range);
}

/** The tags a job can have, most important first: their keys, so colours and words are looked up separately. */
export type JobTag = "urgent" | "meals" | "housing" | "student";

/** Short tags for a job card, most important first. Visa tags state the employer's answer, nothing more. */
export function jobTagKeys(job: Job): JobTag[] {
  const tags: JobTag[] = [];
  if (job.urgent) tags.push("urgent");
  if (job.mealsIncluded) tags.push("meals");
  if (job.accommodationIncluded) tags.push("housing");
  if (job.visaAccepted.includes("student")) tags.push("student");
  return tags;
}

/** The tags' words in the page's language. */
export function jobTags(job: Job, lang: Lang = DEFAULT_LANG): string[] {
  const words = pick(seekerJobsMessages, lang).tags;
  return jobTagKeys(job).map((key) => words[key]);
}

/** "今天" / "today" for the first 24 hours, then "x 天前" / "x days ago". */
export function postedAgo(postedAt: string, now: number, lang: Lang = DEFAULT_LANG): string {
  const days = Math.floor((now - Date.parse(postedAt)) / DAY_MS);
  const words = pick(seekerJobsMessages, lang).posted;
  return days <= 0 ? words.today : words.daysAgo(days);
}

/** postedAgo in Chinese (the name it had before Round 20). */
export function postedAgoZh(postedAt: string, now: number): string {
  return postedAgo(postedAt, now, "zh");
}

/** A region's name in the page's language: the English one on the English page (most are English anyway). */
export function placeName(region: { nameZh: string; nameEn: string } | undefined, lang: Lang = DEFAULT_LANG) {
  return region && (lang === "en" ? region.nameEn : region.nameZh);
}
