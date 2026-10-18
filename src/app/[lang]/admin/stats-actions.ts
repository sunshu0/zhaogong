"use server";

// 审核数据 (#70, PRD R-34) for /admin: worked out on the server from the jobs, reports, moderation log and the calls
// to the AI 发帖 model (#102), for a moderator only (requireModerator, as every /admin Server Function).
import { DEFAULT_COUNTRY } from "@/config/countries";
import { listAllJobs, listModerationLog, listReports } from "@/lib/data";
import { moderationStats, type ModerationStats } from "@/app/[lang]/admin/moderation-stats";
import { listPendingVerifications } from "@/db/verification-requests";
import { listExternalJobs } from "@/db/external-jobs";
import { listAiUsageSince } from "@/db/ai-usage";
import { REFUSED_ZH, requireModerator } from "@/app/[lang]/admin/moderator";
import type { Refused } from "@/app/[lang]/admin/actions";

export async function getModerationStats(): Promise<ModerationStats | Refused> {
  const me = await requireModerator();
  if (!me.ok) return { refused: me.reason, error_zh: REFUSED_ZH[me.reason] };
  const now = Date.now();
  const [jobs, reports, log, verifications, external, aiUsage] = await Promise.all([
    listAllJobs(DEFAULT_COUNTRY),
    listReports(),
    listModerationLog(),
    listPendingVerifications(),
    listExternalJobs(),
    // Eight days back covers the seven New Zealand days whatever the server's time zone.
    listAiUsageSince(new Date(now - 8 * 86_400_000)),
  ]);
  const inMarket = new Set(jobs.map((job) => job.id));
  return moderationStats(
    {
      jobs,
      reports: reports.filter((report) => inMarket.has(report.jobId)),
      log,
      verifications,
      externalPending: external.filter((job) => job.review === "pending" && job.removedAt == null),
      aiUsage,
    },
    now,
  );
}
