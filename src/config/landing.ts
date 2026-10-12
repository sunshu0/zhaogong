// What the landing page may say about the platform. Numbers come from getPlatformStats only.
import type { PlatformStats } from "@/lib/types";

/** True while every number comes from the demo data. The landing page must then say 演示数据 next to them. */
export const DEMO_DATA = true;

/**
 * A number is shown only once it reaches its threshold; below it the stat is left out, never rounded up.
 * While DEMO_DATA is true every stat is shown, with the demo label.
 */
export const STAT_MIN_TO_SHOW: Record<keyof PlatformStats, number> = {
  employersPosting: 30,
  jobsPosted: 100,
  hiresConfirmed: 20,
  contactViews: 200,
};

export const STAT_LABELS: Record<keyof PlatformStats, string> = {
  employersPosting: "家雇主发布过招聘",
  jobsPosted: "个职位",
  hiresConfirmed: "人通过这里找到工作",
  contactViews: "次咨询雇主",
};

/** The stats the landing page may show, in display order. */
export function visibleStats(stats: PlatformStats): { key: keyof PlatformStats; value: number; label: string }[] {
  return (Object.keys(STAT_LABELS) as (keyof PlatformStats)[])
    .filter((key) => DEMO_DATA || stats[key] >= STAT_MIN_TO_SHOW[key])
    .map((key) => ({ key, value: stats[key], label: STAT_LABELS[key] }));
}
