// Text for sharing a job in WeChat groups and elsewhere. The summary is built on the server so the
// share block never receives the whole job (which holds contact details); the client adds the link.
import { regionById } from "@/config/countries";
import { formatEmploymentTypes } from "@/lib/employment-types";
import type { Job } from "@/lib/types";
import { formatPay, jobTags } from "@/components/seeker/format";

/** "【前厅服务员】$25–27/小时" then "Mt Eden / Dominion Rd · 兼职 · 急招 · 包餐". */
export function shareSummary(job: Job): string {
  const facts = [
    regionById(job.country, job.regionId)?.nameZh,
    formatEmploymentTypes(job.employmentType),
    ...jobTags(job),
  ];
  return `【${job.titleZh}】${formatPay(job.pay, job.country)}\n${facts.filter(Boolean).join(" · ")}`;
}

export function withLink(summary: string, url: string): string {
  return `${summary}\n详情：${url}`;
}

export function isWeChat(userAgent: string): boolean {
  return /MicroMessenger/i.test(userAgent);
}
