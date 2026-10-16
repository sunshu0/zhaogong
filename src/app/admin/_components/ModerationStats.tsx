"use client";

import { useEffect, useState } from "react";
import type { Refused } from "@/app/admin/actions";
import { WEEKS, waitZh, type ModerationStats } from "@/app/admin/moderation-stats";
import { moderatorLabel } from "@/app/admin/moderation";
import { getModerationStats } from "@/app/admin/stats-actions";
import { Section } from "@/components/ui/Section";

const weekLabel = new Intl.DateTimeFormat("zh-CN", { timeZone: "UTC", month: "long", day: "numeric" });

/** 「10月12日」 for a week's Monday (already a New Zealand day, so read it as UTC to keep it as is). */
function weekStart(day: string): string {
  return weekLabel.format(new Date(`${day}T00:00:00Z`));
}

/** 审核数据 (#70), asked for again whenever `version` changes (after each decision in the queue). */
export function useModerationStats(version: number): ModerationStats | Refused | undefined {
  const [stats, setStats] = useState<ModerationStats | Refused>();
  useEffect(() => {
    let live = true;
    getModerationStats()
      .then((s) => {
        if (live) setStats(s);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [version]);
  return stats;
}

/** The queue now, above the tabs: what waits for review, and for how long. */
export function ModerationSummary({ stats }: { stats?: ModerationStats }) {
  if (!stats)
    return (
      <div className="-mx-4 h-20 animate-pulse border-y border-border bg-surface sm:mx-0 sm:rounded-md sm:border" />
    );
  const waited = (since?: string) => (since ? `最早的等了 ${waitZh(stats.at - Date.parse(since))}` : "没有在等的");
  return (
    <Section>
      <dl aria-label="审核数据：现在" className="grid grid-cols-2 gap-3 py-group">
        <div>
          <dt className="text-meta text-muted">待审核的职位</dt>
          <dd className="font-figure text-title">{stats.pendingJobs}</dd>
          <dd className="text-meta text-muted">{waited(stats.oldestPendingJobAt)}</dd>
        </div>
        <div>
          <dt className="text-meta text-muted">未处理的举报</dt>
          <dd className="font-figure text-title">{stats.openReports}</dd>
          <dd className="text-meta text-muted">{waited(stats.oldestOpenReportAt)}</dd>
        </div>
      </dl>
    </Section>
  );
}

/** The last eight weeks, this week first: reports, closings and how long they took, take-downs and bans. */
export function ModerationWeeks({ stats }: { stats: ModerationStats }) {
  const most = Math.max(1, ...stats.weeks.map((w) => w.reported));
  return (
    <Section
      title={`最近 ${WEEKS} 周`}
      description="按新西兰时间，每周从周一算起。处理：下架、驳回或封禁时关闭的举报；用时是从提交到关闭的中位数。下架含封禁时一起下架的职位。"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-body">
          <caption className="sr-only">
            最近 {WEEKS} 周每周的新举报、处理的举报、处理用时中位数、下架职位和封禁企业
          </caption>
          <thead>
            <tr className="border-b border-border text-left text-meta text-muted">
              <th scope="col" className="py-2 pr-2 font-normal">
                周
              </th>
              <th scope="col" className="py-2 pr-2 font-normal">
                新举报
              </th>
              <th scope="col" className="py-2 pr-2 text-right font-normal">
                处理
              </th>
              <th scope="col" className="py-2 pr-2 text-right font-normal">
                用时
              </th>
              <th scope="col" className="py-2 pr-2 text-right font-normal">
                下架
              </th>
              <th scope="col" className="py-2 text-right font-normal">
                封禁
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {stats.weeks.map((w, i) => (
              <tr key={w.week}>
                <th scope="row" className="py-2 pr-2 text-left font-normal whitespace-nowrap">
                  {i === 0 ? "本周" : `${weekStart(w.week)}起`}
                </th>
                <td className="py-2 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 text-right font-figure">{w.reported}</span>
                    <span
                      aria-hidden
                      className="h-2 rounded-sm bg-brand/60"
                      style={{ width: `${(w.reported / most) * 100}%`, maxWidth: "4rem" }}
                    />
                  </div>
                </td>
                <td className="py-2 pr-2 text-right font-figure">{w.handled}</td>
                <td className="py-2 pr-2 text-right whitespace-nowrap">
                  {w.medianHandleMs == null ? "—" : waitZh(w.medianHandleMs)}
                </td>
                <td className="py-2 pr-2 text-right font-figure">{w.takenDown}</td>
                <td className="py-2 text-right font-figure">{w.banned}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {stats.untimed > 0 && (
        <p className="py-group text-meta text-muted">
          另有 {stats.untimed} 条举报在开始记录处理时间之前就处理完了，不计入用时。
        </p>
      )}
    </Section>
  );
}

const DECISIONS = [
  ["approve", "通过"],
  ["takeDown", "下架"],
  ["dismiss", "驳回"],
  ["ban", "封禁"],
] as const;

/** Decisions per moderator over the same eight weeks (#60 names who acted), most first. */
export function ModeratorWeeks({ stats }: { stats: ModerationStats }) {
  return (
    <Section title="按审核员" description={`最近 ${WEEKS} 周每位审核员做的处理。封禁一次算一次，不按下架的职位数算。`}>
      {stats.byModerator.length === 0 ? (
        <p className="py-group text-body text-muted">最近 {WEEKS} 周没有处理记录。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-body">
            <caption className="sr-only">最近 {WEEKS} 周每位审核员的通过、下架、驳回、封禁次数</caption>
            <thead>
              <tr className="border-b border-border text-left text-meta text-muted">
                <th scope="col" className="py-2 pr-2 font-normal">
                  审核员
                </th>
                {DECISIONS.map(([key, label]) => (
                  <th key={key} scope="col" className="py-2 pr-2 text-right font-normal">
                    {label}
                  </th>
                ))}
                <th scope="col" className="py-2 text-right font-normal">
                  合计
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {stats.byModerator.map((m) => (
                <tr key={m.moderator ?? ""}>
                  <th scope="row" className="max-w-40 py-2 pr-2 text-left font-normal break-all">
                    {moderatorLabel(m.moderator)}
                  </th>
                  {DECISIONS.map(([key]) => (
                    <td key={key} className="py-2 pr-2 text-right font-figure">
                      {m[key]}
                    </td>
                  ))}
                  <td className="py-2 text-right font-figure">{m.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
