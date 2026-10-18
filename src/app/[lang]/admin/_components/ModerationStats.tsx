"use client";

import type { Refused } from "@/app/[lang]/admin/actions";
import { isFailed, ready, type Failed } from "@/app/[lang]/admin/load-state";
import { AI_DAYS, WEEKS, waitZh, type ModerationStats } from "@/app/[lang]/admin/moderation-stats";
import { moderatorLabel } from "@/app/[lang]/admin/moderation";
import { getModerationStats } from "@/app/[lang]/admin/stats-actions";
import { Loading } from "@/app/[lang]/admin/_components/Empty";
import { LoadFailed } from "@/app/[lang]/admin/_components/Failed";
import { useAdminLoad } from "@/app/[lang]/admin/_components/use-admin-load";
import { Section } from "@/components/ui/Section";

const weekLabel = new Intl.DateTimeFormat("zh-CN", { timeZone: "UTC", month: "long", day: "numeric" });

/** 「10月12日」 for a week's Monday (already a New Zealand day, so read it as UTC to keep it as is). */
function weekStart(day: string): string {
  return weekLabel.format(new Date(`${day}T00:00:00Z`));
}

const dayLabel = new Intl.DateTimeFormat("zh-CN", { timeZone: "UTC", month: "long", day: "numeric", weekday: "short" });
const figure = new Intl.NumberFormat("zh-CN");

/** 审核数据 (#70), asked for again whenever `version` changes (after each decision in the queue). */
export function useModerationStats(version: number): ModerationStats | Refused | Failed | undefined {
  return useAdminLoad<ModerationStats | Refused>(getModerationStats, version);
}

/** The queue now, above the tabs: what waits for review, and for how long. Says so when none came (#183). */
export function ModerationSummary({
  stats: answer,
  onRetry,
}: {
  stats?: ModerationStats | Refused | Failed;
  onRetry: () => void;
}) {
  if (isFailed(answer)) return <LoadFailed what="审核数据" onRetry={onRetry} />;
  const stats = ready(answer);
  if (!stats) return <Loading cards={1} height="h-20" />;
  const waited = (since?: string) => (since ? `最早的等了 ${waitZh(stats.at - Date.parse(since))}` : "没有在等的");
  return (
    <Section look="app">
      <dl aria-label="审核数据：现在" className="grid grid-cols-2 gap-3 py-group sm:grid-cols-4">
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
        <div>
          <dt className="text-meta text-muted">待审核的企业验证</dt>
          <dd className="font-figure text-title">{stats.pendingVerifications}</dd>
          <dd className="text-meta text-muted">{waited(stats.oldestPendingVerificationAt)}</dd>
        </div>
        <div>
          <dt className="text-meta text-muted">待审核的外部职位</dt>
          <dd className="font-figure text-title">{stats.pendingExternal}</dd>
          <dd className="text-meta text-muted">{waited(stats.oldestPendingExternalAt)}</dd>
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
      look="app"
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
  ["verify", "企业验证"],
  ["external", "外部职位"],
] as const;

/** Decisions per moderator over the same eight weeks (#60 names who acted), most first. */
export function ModeratorWeeks({ stats }: { stats: ModerationStats }) {
  return (
    <Section
      look="app"
      title="按审核员"
      description={`最近 ${WEEKS} 周每位审核员做的处理。封禁一次算一次，不按下架的职位数算。`}
    >
      {stats.byModerator.length === 0 ? (
        <p className="py-group text-body text-muted">最近 {WEEKS} 周没有处理记录。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-body">
            <caption className="sr-only">最近 {WEEKS} 周每位审核员的通过、下架、驳回、封禁和企业验证次数</caption>
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

/** AI 发帖用量 (#102): calls to the posting model over the last seven days, today first, and the seven together. */
export function AiPostingUsage({ stats }: { stats: ModerationStats }) {
  const { days, total } = stats.aiPosting;
  const rows = [
    ...days.map((d, i) => ({ ...d, label: i === 0 ? "今天" : dayLabel.format(new Date(`${d.day}T00:00:00Z`)) })),
    { ...total, label: `${AI_DAYS} 天合计` },
  ];
  return (
    <Section
      look="app"
      title="AI 发帖用量"
      description={`最近 ${AI_DAYS} 天对话发布调用模型的次数，按新西兰时间。token 含输入、输出和缓存；失败是出错、被拒或读不出答案；超限是每个账号每分钟 6 次、每天 100 次的上限挡下的，没有调用模型。`}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-body">
          <caption className="sr-only">最近 {AI_DAYS} 天每天调用 AI 发帖模型的次数、token、失败和超限次数</caption>
          <thead>
            <tr className="border-b border-border text-left text-meta text-muted">
              <th scope="col" className="py-2 pr-2 font-normal">
                日期
              </th>
              <th scope="col" className="py-2 pr-2 text-right font-normal">
                调用
              </th>
              <th scope="col" className="py-2 pr-2 text-right font-normal">
                token
              </th>
              <th scope="col" className="py-2 pr-2 text-right font-normal">
                失败
              </th>
              <th scope="col" className="py-2 text-right font-normal">
                超限
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((d) => (
              <tr key={d.day} className={d.day === "total" ? "font-medium" : undefined}>
                <th scope="row" className="py-2 pr-2 text-left font-normal whitespace-nowrap">
                  {d.label}
                </th>
                <td className="py-2 pr-2 text-right font-figure">{d.calls}</td>
                <td className="py-2 pr-2 text-right font-figure">{figure.format(d.tokens)}</td>
                <td className="py-2 pr-2 text-right font-figure">{d.failed}</td>
                <td className="py-2 text-right font-figure">{d.limited}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
