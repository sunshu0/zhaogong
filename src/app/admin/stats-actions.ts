"use server";

// 审核数据 (#70, PRD R-34) for /admin: worked out on the server from the jobs, reports and moderation log, for a
// moderator only (requireModerator, as every /admin Server Function).
import { DEFAULT_COUNTRY } from "@/config/countries";
import { listAllJobs, listModerationLog, listReports } from "@/lib/data";
import { moderationStats, type ModerationStats } from "@/app/admin/moderation-stats";
import { REFUSED_ZH, requireModerator } from "@/app/admin/moderator";
import type { Refused } from "@/app/admin/actions";

export async function getModerationStats(): Promise<ModerationStats | Refused> {
  const me = await requireModerator();
  if (!me.ok) return { refused: me.reason, error_zh: REFUSED_ZH[me.reason] };
  const [jobs, reports, log] = await Promise.all([listAllJobs(DEFAULT_COUNTRY), listReports(), listModerationLog()]);
  const inMarket = new Set(jobs.map((job) => job.id));
  return moderationStats({ jobs, reports: reports.filter((report) => inMarket.has(report.jobId)), log }, Date.now());
}
