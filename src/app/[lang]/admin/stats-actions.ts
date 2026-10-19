"use server";

// 审核数据 (#70, PRD R-34) for /admin: worked out on the server from the jobs, reports, moderation log and the calls
// to the AI 发帖 model (#102), for a moderator only (requireModerator, as every /admin Server Function).
import { DEFAULT_COUNTRY } from "@/config/countries";
import { listAllJobs, listModerationLog, listReports } from "@/lib/data";
import { moderationStats, type ModerationStats } from "@/app/[lang]/admin/moderation-stats";
import { listPendingVerifications } from "@/db/verification-requests";
import { listExternalJobs } from "@/db/external-jobs";
import { listAiUsageSince } from "@/db/ai-usage";
import { refusedText, requireModerator } from "@/app/[lang]/admin/moderator";
import type { Refused } from "@/app/[lang]/admin/actions";
import { asc, gte } from "drizzle-orm";
import { database } from "@/db/ready";
import * as t from "@/db/schema";
import { lastDays } from "@/db/job-stats";
import { FUNNEL_DAYS, funnelReport, type FunnelDays, type FunnelReport } from "@/app/[lang]/admin/funnels";

export async function getModerationStats(): Promise<ModerationStats | Refused> {
  const me = await requireModerator();
  if (!me.ok) return { refused: me.reason, error_zh: await refusedText(me.reason) };
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

/**
 * 审核数据's 漏斗 (#316, ADR 0025 §5): the last 7 or 30 New Zealand days of the anonymous events, as counts per step,
 * for a moderator only. Only the counts leave the server (funnels.ts), never a visitor or a row.
 */
export async function getFunnels(days: unknown): Promise<FunnelReport | Refused> {
  const me = await requireModerator();
  if (!me.ok) return { refused: me.reason, error_zh: await refusedText(me.reason) };
  const period: FunnelDays = FUNNEL_DAYS.find((d) => d === days) ?? 7;
  const db = await database();
  const rows = await db
    .select({
      visitor: t.events.visitor,
      day: t.events.day,
      name: t.events.name,
      lang: t.events.lang,
      role: t.events.role,
    })
    .from(t.events)
    .where(gte(t.events.day, lastDays(new Date(), period)[0]))
    .orderBy(asc(t.events.at), asc(t.events.id));
  return funnelReport(rows, period);
}
