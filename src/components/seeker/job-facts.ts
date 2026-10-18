// Facts shown on the job detail page and in its share metadata. Pure functions so they can be unit-tested.
import { COUNTRIES, regionById } from "@/config/countries";
import { formatEmploymentTypes } from "@/lib/employment-types";
import type { CountryCode, Employer, EmployerVerification, Job, PayRange } from "@/lib/types";
import { DAY_MS, formatMoney, formatPay } from "@/components/seeker/format";
import { DEFAULT_LANG, localeTag, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { seekerJobsMessages } from "@/i18n/messages/seeker-jobs";

/** Pay within this many dollars above the minimum wage gets a note. */
const NEAR_MINIMUM_WAGE = 1;

// Not in the country config yet; dates on job pages are shown in the market's local time.
const TIME_ZONES: Record<CountryCode, string> = { NZ: "Pacific/Auckland", AU: "Australia/Sydney" };

export interface PayNote {
  level: "below" | "at" | "near";
  text: string;
}

/**
 * A note when the lowest advertised rate is below, at or just above the country's adult minimum wage (the one the
 * platform checks, 导师决定 3).
 */
export function minimumWageNote(pay: PayRange, country: CountryCode, lang: Lang = DEFAULT_LANG): PayNote | undefined {
  const config = COUNTRIES[country];
  const { hourly, effectiveFrom } = config.minimumWage;
  if (!hourly) return undefined;

  const t = pick(seekerJobsMessages, lang).minimumWage;
  const name = lang === "en" ? config.nameEn : config.nameZh;
  const rate = t.rate(name, `${config.currencySymbol}${formatMoney(hourly, lang)}`, effectiveFrom);
  const cents = Math.round(pay.min * 100) - Math.round(hourly * 100);
  if (cents < 0) return { level: "below", text: t.below(rate) };
  if (cents === 0) return { level: "at", text: t.at(rate) };
  if (cents <= NEAR_MINIMUM_WAGE * 100) return { level: "near", text: t.near(rate) };
  return undefined;
}

/** One line on what the employer's badge means. */
export function verificationNote(
  verification: EmployerVerification,
  country: CountryCode,
  lang: Lang = DEFAULT_LANG,
): string {
  const number = COUNTRIES[country].businessNumberLabel;
  const t = pick(seekerJobsMessages, lang).verification;
  switch (verification) {
    case "accredited_employer":
      return t.accredited(number);
    case "business_verified":
      return t.verified(number);
    case "unverified":
      return t.unverified;
  }
}

/** "前厅服务员 · $25–27/小时 · Mt Eden / Dominion Rd" — what a WeChat share card shows as the title. */
export function shareTitle(job: Job): string {
  const region = regionById(job.country, job.regionId)?.nameZh;
  return [job.titleZh, formatPay(job.pay, job.country), region].filter(Boolean).join(" · ");
}

export function shareDescription(job: Job, employer: Employer | undefined): string {
  const head = [employer?.name, formatEmploymentTypes(job.employmentType)].filter(Boolean).join(" · ");
  const text = `${head} · ${job.descriptionZh}`;
  return text.length > 100 ? `${text.slice(0, 99)}…` : text;
}

const dateFormats = new Map<string, Intl.DateTimeFormat>();

/** "10月11日" / "11 October" in the market's local time. */
export function formatJobDate(iso: string, country: CountryCode, lang: Lang = DEFAULT_LANG): string {
  const key = `${lang} ${country}`;
  let format = dateFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(localeTag(lang), { timeZone: TIME_ZONES[country], month: "long", day: "numeric" });
    dateFormats.set(key, format);
  }
  return format.format(new Date(iso));
}

/** formatJobDate in Chinese (its name before Round 20). */
export function formatDateZh(iso: string, country: CountryCode): string {
  return formatJobDate(iso, country, "zh");
}

/** "11月9日截止（还有 29 天）" / "Closes 9 November (in 29 days)", or "10月10日已截止" / "Closed 10 October". */
export function expiry(expiresAt: string, now: number, country: CountryCode, lang: Lang = DEFAULT_LANG): string {
  const date = formatJobDate(expiresAt, country, lang);
  const days = Math.ceil((Date.parse(expiresAt) - now) / DAY_MS);
  const t = pick(seekerJobsMessages, lang).closes;
  return days > 0 ? t.inDays(date, days) : t.closed(date);
}

/** expiry in Chinese (its name before Round 20). */
export function expiryZh(expiresAt: string, now: number, country: CountryCode): string {
  return expiry(expiresAt, now, country, "zh");
}

/** Which kinds of contact a job has ("电话", "微信", "邮箱" / phone, WeChat, email), without the details themselves. */
export function contactKinds(job: Job, lang: Lang = DEFAULT_LANG): string[] {
  const { phone, wechat, email } = job.contact;
  const t = pick(seekerJobsMessages, lang).contact;
  return [phone && t.phone, wechat && t.wechat, email && t.email].filter((k): k is string => Boolean(k));
}

/** Job seekers can open active and expired jobs; removed and unreviewed ones are not found. */
export function isPublic(job: Job): boolean {
  return job.status === "active" || job.status === "expired";
}

export function isExpired(job: Job, now: number): boolean {
  return job.status === "expired" || Date.parse(job.expiresAt) <= now;
}
