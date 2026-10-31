// Pieces of the landing page that are not markup. Everything said here must be true of the product today.
// Round 20: the words in the page's language (seeker-home dictionary), the counts formatted for it.
import { visibleStats } from "@/config/landing";
import { formatNumber } from "@/i18n/format";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { seekerHomeMessages } from "@/i18n/messages/seeker-home";
import type { Job, PlatformStats } from "@/lib/types";

/** 1234 → "1,234". Counts are shown exactly as counted, never rounded up. */
export function formatCount(n: number, lang: Lang = DEFAULT_LANG): string {
  return formatNumber(n, lang);
}

/**
 * The home page's one line of numbers (#51): open jobs and the verified employers among them, then the platform's
 * hires and contacts where they may be shown (visibleStats: past their thresholds, or all while it is demo data).
 * Jobs and employers ever posted are left out: they would repeat the first two. On demo data (`demo`) the second
 * figure is all the jobs' employers, called 演示企业 as on the cards: no demo business is claimed verified (user
 * feedback 10-30 #2).
 */
export function heroCounts(
  openJobs: number,
  employers: number,
  stats: PlatformStats,
  lang: Lang = DEFAULT_LANG,
  demo = false,
): { value: number; label: string }[] {
  const t = pick(seekerHomeMessages, lang).counts;
  return [
    { value: openJobs, label: t.openJobs(openJobs) },
    { value: employers, label: demo ? t.demoEmployers(employers) : t.verifiedEmployers(employers) },
    ...visibleStats(stats)
      .filter((s) => s.key === "hiresConfirmed" || s.key === "contactViews")
      .map(({ key, value }) => ({ value, label: t[key](value) })),
  ];
}

/** visibleStats with their words in the page's language (the no-JavaScript summary). */
export function statLines(stats: PlatformStats, lang: Lang = DEFAULT_LANG) {
  const t = pick(seekerHomeMessages, lang).counts;
  return visibleStats(stats).map(({ key, value }) => ({ key, value, label: t[key](value) }));
}

/**
 * 最新职位 (user feedback 8, 10-30): the open jobs of verified employers in the job list's own order (`jobs` from
 * listJobs: newest first, urgent first within an Auckland day), leaving out the ones the window notices show.
 */
export function latestVerifiedJobs<J extends Pick<Job, "id" | "employerId">>(
  jobs: readonly J[],
  verified: ReadonlySet<string>,
  shown: readonly Pick<Job, "id">[],
  limit: number,
): J[] {
  const skip = new Set(shown.map((j) => j.id));
  return jobs.filter((j) => verified.has(j.employerId) && !skip.has(j.id)).slice(0, limit);
}

export type FeatureIcon = "chat" | "language" | "check" | "shield";

/** The AI chat post (with its replay), in the employer band since feedback 8. Only what the product does now. */
export function aiFeature(lang: Lang = DEFAULT_LANG) {
  const t = pick(seekerHomeMessages, lang).features;
  return { title: t.aiTitle, text: t.aiText };
}

export function features(lang: Lang = DEFAULT_LANG): { title: string; text: string; icon: FeatureIcon }[] {
  const t = pick(seekerHomeMessages, lang).features;
  return [
    { title: t.checksTitle, text: t.checksText, icon: "check" },
    { title: t.trustTitle, text: t.trustText, icon: "shield" },
    { title: t.chineseTitle, text: t.chineseText, icon: "language" },
  ];
}

/**
 * The employer band's "before": the first three lines of MSG.frontOfHouse in src/lib/ai-post/parse.test.ts.
 * The fourth line (WeChat and phone) is left out: contact details are for signed-in users only. A Chinese posting
 * on either page: it is what employers paste.
 */
export const EMPLOYER_EXAMPLE = `【急招】Mt Eden 川菜馆招前厅服务员 2 名
时薪 $25-27，每周 15-25 小时，周五至周日晚班
包工作餐，接受学签，需会普通话和基本英语`;
