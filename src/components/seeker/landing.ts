// Pieces of the landing page that are not markup. Everything said here must be true of the product today.
import { visibleStats } from "@/config/landing";
import type { PlatformStats } from "@/lib/types";

/** 1234 → "1,234". Counts are shown exactly as counted, never rounded up. */
export function formatCount(n: number): string {
  return new Intl.NumberFormat("zh-CN").format(n);
}

/**
 * The home page's one line of numbers (#51): open jobs and the verified employers among them, then the platform's
 * hires and contacts where they may be shown (visibleStats: past their thresholds, or all while it is demo data).
 * Jobs and employers ever posted are left out: they would repeat the first two.
 */
export function heroCounts(
  openJobs: number,
  verifiedEmployers: number,
  stats: PlatformStats,
): { value: number; label: string }[] {
  return [
    { value: openJobs, label: "个职位在招，来自" },
    { value: verifiedEmployers, label: "家已验证雇主" },
    ...visibleStats(stats)
      .filter((s) => s.key === "hiresConfirmed" || s.key === "contactViews")
      .map(({ value, label }) => ({ value, label })),
  ];
}

export type FeatureIcon = "chat" | "language" | "check" | "shield";

/** 功能展示: the AI chat post first (with its replay), then three more. Only what the product does now. */
export const AI_FEATURE = {
  title: "AI 对话发帖",
  text: "雇主粘贴一段微信招聘消息，助手一问一答补齐时薪、地区、工时、签证和联系方式；违规的说法当场指出，帮你改好。",
};

export const FEATURES: { title: string; text: string; icon: FeatureIcon }[] = [
  {
    title: "发布前合规检查",
    text: "低于最低工资不能发布；押金、介绍费、包签、限华人等说法会被拦下或要求改写。",
    icon: "check",
  },
  {
    title: "雇主验证与防骗",
    text: "核对过企业登记的雇主带认证标志；联系方式只给登录的人，或在聊天中双方同意后交换；每个职位都能举报，有人审核。",
    icon: "shield",
  },
  { title: "中文为主", text: "全中文页面，职位中英文对照；求职者浏览、注册、联系雇主都不收费。", icon: "language" },
];

/**
 * The employer band's "before": the first three lines of MSG.frontOfHouse in src/lib/ai-post/parse.test.ts.
 * The fourth line (WeChat and phone) is left out: contact details are for signed-in users only.
 */
export const EMPLOYER_EXAMPLE = `【急招】Mt Eden 川菜馆招前厅服务员 2 名
时薪 $25-27，每周 15-25 小时，周五至周日晚班
包工作餐，接受学签，需会普通话和基本英语`;
