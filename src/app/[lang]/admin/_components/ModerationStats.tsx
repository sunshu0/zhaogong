"use client";

import type { Refused } from "@/app/[lang]/admin/actions";
import { isFailed, ready, type Failed } from "@/app/[lang]/admin/load-state";
import { AI_DAYS, WEEKS, waitText, type ModerationStats } from "@/app/[lang]/admin/moderation-stats";
import { moderatorLabel } from "@/app/[lang]/admin/moderation";
import { getModerationStats } from "@/app/[lang]/admin/stats-actions";
import { Loading } from "@/app/[lang]/admin/_components/Empty";
import { LoadFailed } from "@/app/[lang]/admin/_components/Failed";
import { useAdminLoad } from "@/app/[lang]/admin/_components/use-admin-load";
import { Section } from "@/components/ui/Section";
import { useLang, useMessages } from "@/i18n/client";
import { formatDate, formatNumber } from "@/i18n/format";
import type { Lang } from "@/i18n/lang";
import { adminStatsMessages } from "@/i18n/messages/admin-stats";

/**
 * 「10月12日」 / 「12 October」 for a week's Monday, and 「10月12日周一」 / 「Mon, 12 October」 for a day: already New
 * Zealand days, so read them as UTC to keep them as they are.
 */
function dayOf(day: string, lang: Lang, weekday = false): string {
  return formatDate(`${day}T00:00:00Z`, lang, {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    ...(weekday && { weekday: "short" }),
  });
}

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
  const lang = useLang();
  const t = useMessages(adminStatsMessages);
  if (isFailed(answer)) return <LoadFailed what={t.name} onRetry={onRetry} />;
  const stats = ready(answer);
  if (!stats) return <Loading cards={1} height="h-20" />;
  const waited = (since?: string) =>
    since ? t.now.oldestWaited(waitText(stats.at - Date.parse(since), lang)) : t.now.noneWaiting;
  return (
    <Section look="sheet">
      <dl aria-label={t.now.label} className="grid grid-cols-2 gap-3 py-group sm:grid-cols-4">
        <div>
          <dt className="text-meta text-muted">{t.now.jobs}</dt>
          <dd className="font-figure text-title">{stats.pendingJobs}</dd>
          <dd className="text-meta text-muted">{waited(stats.oldestPendingJobAt)}</dd>
        </div>
        <div>
          <dt className="text-meta text-muted">{t.now.reports}</dt>
          <dd className="font-figure text-title">{stats.openReports}</dd>
          <dd className="text-meta text-muted">{waited(stats.oldestOpenReportAt)}</dd>
        </div>
        <div>
          <dt className="text-meta text-muted">{t.now.verifications}</dt>
          <dd className="font-figure text-title">{stats.pendingVerifications}</dd>
          <dd className="text-meta text-muted">{waited(stats.oldestPendingVerificationAt)}</dd>
        </div>
        <div>
          <dt className="text-meta text-muted">{t.now.external}</dt>
          <dd className="font-figure text-title">{stats.pendingExternal}</dd>
          <dd className="text-meta text-muted">{waited(stats.oldestPendingExternalAt)}</dd>
        </div>
      </dl>
    </Section>
  );
}

/** The last eight weeks, this week first: reports, closings and how long they took, take-downs and bans. */
export function ModerationWeeks({ stats }: { stats: ModerationStats }) {
  const lang = useLang();
  const t = useMessages(adminStatsMessages).weeks;
  const most = Math.max(1, ...stats.weeks.map((w) => w.reported));
  return (
    <Section look="sheet" title={t.title(WEEKS)} description={t.description}>
      <div role="region" aria-label={t.title(WEEKS)} tabIndex={0} className="overflow-x-auto">
        <table className="w-full text-body">
          <caption className="sr-only">{t.caption(WEEKS)}</caption>
          <thead>
            <tr className="border-b border-border text-left text-meta text-muted">
              <th scope="col" className="py-2 pr-2 font-normal">
                {t.week}
              </th>
              <th scope="col" className="py-2 pr-2 font-normal">
                {t.newReports}
              </th>
              <th scope="col" className="py-2 pr-2 text-right font-normal">
                {t.handled}
              </th>
              <th scope="col" className="py-2 pr-2 text-right font-normal">
                {t.time}
              </th>
              <th scope="col" className="py-2 pr-2 text-right font-normal">
                {t.takenDown}
              </th>
              <th scope="col" className="py-2 text-right font-normal">
                {t.banned}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {stats.weeks.map((w, i) => (
              <tr key={w.week}>
                <th scope="row" className="py-2 pr-2 text-left font-normal whitespace-nowrap">
                  {i === 0 ? t.thisWeek : t.weekOf(dayOf(w.week, lang))}
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
                  {w.medianHandleMs == null ? "—" : waitText(w.medianHandleMs, lang)}
                </td>
                <td className="py-2 pr-2 text-right font-figure">{w.takenDown}</td>
                <td className="py-2 text-right font-figure">{w.banned}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {stats.untimed > 0 && <p className="py-group text-meta text-muted">{t.untimed(stats.untimed)}</p>}
    </Section>
  );
}

const DECISIONS = ["approve", "takeDown", "dismiss", "ban", "verify", "external"] as const;

/** Decisions per moderator over the same eight weeks (#60 names who acted), most first. */
export function ModeratorWeeks({ stats }: { stats: ModerationStats }) {
  const lang = useLang();
  const t = useMessages(adminStatsMessages).byModerator;
  return (
    <Section look="sheet" title={t.title} description={t.description(WEEKS)}>
      {stats.byModerator.length === 0 ? (
        <p className="py-group text-body text-muted">{t.none(WEEKS)}</p>
      ) : (
        <div role="region" aria-label={t.title} tabIndex={0} className="overflow-x-auto">
          <table className="w-full text-body">
            <caption className="sr-only">{t.caption(WEEKS)}</caption>
            <thead>
              <tr className="border-b border-border text-left text-meta text-muted">
                <th scope="col" className="py-2 pr-2 font-normal">
                  {t.moderator}
                </th>
                {DECISIONS.map((key) => (
                  <th key={key} scope="col" className="py-2 pr-2 text-right font-normal">
                    {t[key]}
                  </th>
                ))}
                <th scope="col" className="py-2 text-right font-normal">
                  {t.total}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {stats.byModerator.map((m) => (
                <tr key={m.moderator ?? ""}>
                  <th scope="row" className="max-w-40 py-2 pr-2 text-left font-normal break-all">
                    {moderatorLabel(m.moderator, lang)}
                  </th>
                  {DECISIONS.map((key) => (
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
  const lang = useLang();
  const t = useMessages(adminStatsMessages).ai;
  const { days, total } = stats.aiPosting;
  const rows = [
    ...days.map((d, i) => ({ ...d, label: i === 0 ? t.today : dayOf(d.day, lang, true) })),
    { ...total, label: t.total(AI_DAYS) },
  ];
  return (
    <Section look="sheet" title={t.title} description={t.description(AI_DAYS)}>
      <div role="region" aria-label={t.title} tabIndex={0} className="overflow-x-auto">
        <table className="w-full text-body">
          <caption className="sr-only">{t.caption(AI_DAYS)}</caption>
          <thead>
            <tr className="border-b border-border text-left text-meta text-muted">
              <th scope="col" className="py-2 pr-2 font-normal">
                {t.date}
              </th>
              <th scope="col" className="py-2 pr-2 text-right font-normal">
                {t.calls}
              </th>
              <th scope="col" className="py-2 pr-2 text-right font-normal">
                {t.tokens}
              </th>
              <th scope="col" className="py-2 pr-2 text-right font-normal">
                {t.failed}
              </th>
              <th scope="col" className="py-2 text-right font-normal">
                {t.limited}
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
                <td className="py-2 pr-2 text-right font-figure">{formatNumber(d.tokens, lang)}</td>
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
