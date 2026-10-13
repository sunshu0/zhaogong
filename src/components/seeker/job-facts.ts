// Facts shown on the job detail page and in its share metadata. Pure functions so they can be unit-tested.
import { COUNTRIES, regionById } from "@/config/countries";
import { formatEmploymentTypes } from "@/lib/employment-types";
import type { CountryCode, Employer, EmployerVerification, Job, PayRange } from "@/lib/types";
import { DAY_MS, formatMoney, formatPay } from "@/components/seeker/format";

/** Pay within this many dollars above the minimum wage gets a note. */
const NEAR_MINIMUM_WAGE = 1;

// Not in the country config yet; dates on job pages are shown in the market's local time.
const TIME_ZONES: Record<CountryCode, string> = { NZ: "Pacific/Auckland", AU: "Australia/Sydney" };

export interface PayNote {
  level: "below" | "at" | "near";
  text: string;
}

/** A note when the lowest advertised rate is below, at or just above the country's adult minimum wage. */
export function minimumWageNote(pay: PayRange, country: CountryCode): PayNote | undefined {
  const config = COUNTRIES[country];
  const { hourly, effectiveFrom } = config.minimumWage;
  if (!hourly) return undefined;

  const rate = `${config.nameZh}最低时薪 ${config.currencySymbol}${formatMoney(hourly)}（${effectiveFrom} 起）`;
  const cents = Math.round(pay.min * 100) - Math.round(hourly * 100);
  if (cents < 0) return { level: "below", text: `低于${rate}。雇主不得低于最低工资支付，如有疑问可以举报这个职位。` };
  if (cents === 0) return { level: "at", text: `等于${rate}。` };
  if (cents <= NEAR_MINIMUM_WAGE * 100) return { level: "near", text: `接近${rate}。` };
  return undefined;
}

/** One line on what the employer's badge means. */
export function verificationNote(verification: EmployerVerification, country: CountryCode): string {
  const number = COUNTRIES[country].businessNumberLabel;
  switch (verification) {
    case "accredited_employer":
      return `已核对企业登记（${number}），雇主为移民局认证雇主。`;
    case "business_verified":
      return `已核对企业登记（${number}），确认这家企业真实存在。`;
    case "unverified":
      return "雇主还没有完成企业验证。请自行核实，不要向雇主支付任何费用。";
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

/** "10月11日" in the market's local time. */
export function formatDateZh(iso: string, country: CountryCode): string {
  return new Intl.DateTimeFormat("zh-CN", { timeZone: TIME_ZONES[country], month: "long", day: "numeric" }).format(
    new Date(iso),
  );
}

/** "11月9日截止（还有 29 天）", or "10月10日已截止". */
export function expiryZh(expiresAt: string, now: number, country: CountryCode): string {
  const date = formatDateZh(expiresAt, country);
  const days = Math.ceil((Date.parse(expiresAt) - now) / DAY_MS);
  return days > 0 ? `${date}截止（还有 ${days} 天）` : `${date}已截止`;
}

/** Which kinds of contact a job has ("电话", "微信", "邮箱"), without the details themselves. */
export function contactKinds(job: Job): string[] {
  const { phone, wechat, email } = job.contact;
  return [phone && "电话", wechat && "微信", email && "邮箱"].filter((k): k is string => Boolean(k));
}

/** Job seekers can open active and expired jobs; removed and unreviewed ones are not found. */
export function isPublic(job: Job): boolean {
  return job.status === "active" || job.status === "expired";
}

export function isExpired(job: Job, now: number): boolean {
  return job.status === "expired" || Date.parse(job.expiresAt) <= now;
}
