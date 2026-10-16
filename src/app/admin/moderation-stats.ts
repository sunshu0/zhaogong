// 审核数据 (#70, PRD R-34): what the moderation queue looks like now, and the last eight weeks of reports and
// decisions. Pure, so the numbers are tested without a database; stats-actions.ts feeds it on the server. The data
// is small, so it is worked out from whole tables on each request (ADR 0010 says what to do when it is not).
import type { Job, ModerationLogEntry, Report } from "@/lib/types";

export const WEEKS = 8;
const DAY_MS = 86_400_000;
const nzDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Auckland" });

/** The day in New Zealand, YYYY-MM-DD. */
export function nzDay(at: number): string {
  return nzDate.format(at);
}

/** The Monday of a day's week (weeks run Monday to Sunday, in New Zealand). */
export function weekOf(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  const sinceMonday = (date.getUTCDay() + 6) % 7;
  return new Date(date.getTime() - sinceMonday * DAY_MS).toISOString().slice(0, 10);
}

/** The Mondays of the last `n` weeks, this week first. */
export function lastWeeks(now: number, n = WEEKS): string[] {
  const monday = Date.parse(`${weekOf(nzDay(now))}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => new Date(monday - i * 7 * DAY_MS).toISOString().slice(0, 10));
}

export function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export type WeekStats = {
  /** The week's Monday, YYYY-MM-DD. */
  week: string;
  /** Reports made that week. */
  reported: number;
  /** Reports closed that week (taken down, dismissed, or closed by a ban). */
  handled: number;
  /** Median time from a report to its closing, for the reports closed that week that have a closing time. */
  medianHandleMs: number | null;
  /** Jobs taken down: one by one, and those a ban took down with it. */
  takenDown: number;
  /** Businesses banned. */
  banned: number;
};

/** One moderator's decisions over the eight weeks (#60 names who acted). */
export type ModeratorStats = {
  /** The moderator's email, "deleted-account", or undefined for entries from before #60. */
  moderator?: string;
  approve: number;
  takeDown: number;
  dismiss: number;
  ban: number;
  total: number;
};

export type ModerationStats = {
  /** When these numbers were worked out (the server's clock), to say how long the oldest items have waited. */
  at: number;
  pendingJobs: number;
  openReports: number;
  /** When the oldest job waiting for review was posted, and the oldest open report made. */
  oldestPendingJobAt?: string;
  oldestOpenReportAt?: string;
  /** This week first. */
  weeks: WeekStats[];
  /** Decisions per moderator over the same eight weeks, most first. */
  byModerator: ModeratorStats[];
  /** Closed reports without a closing time: closed before closing times were kept (migration 0008). */
  untimed: number;
};

const oldest = (dates: string[]) => (dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : undefined);

export function moderationStats(
  { jobs, reports, log }: { jobs: readonly Job[]; reports: readonly Report[]; log: readonly ModerationLogEntry[] },
  now: number,
): ModerationStats {
  const weeks = lastWeeks(now);
  const rows = new Map<string, WeekStats & { times: number[] }>(
    weeks.map((week) => [
      week,
      { week, reported: 0, handled: 0, medianHandleMs: null, takenDown: 0, banned: 0, times: [] },
    ]),
  );
  const row = (at: string) => rows.get(weekOf(nzDay(Date.parse(at))));

  let untimed = 0;
  for (const report of reports) {
    const made = row(report.createdAt);
    if (made) made.reported += 1;
    if (report.status === "open") continue;
    if (!report.handledAt) {
      untimed += 1;
      continue;
    }
    const closed = row(report.handledAt);
    if (!closed) continue;
    closed.handled += 1;
    closed.times.push(Math.max(0, Date.parse(report.handledAt) - Date.parse(report.createdAt)));
  }
  const moderators = new Map<string | undefined, ModeratorStats>();
  for (const entry of log) {
    const week = row(entry.at);
    if (!week) continue;
    const who = moderators.get(entry.moderator) ?? {
      moderator: entry.moderator,
      approve: 0,
      takeDown: 0,
      dismiss: 0,
      ban: 0,
      total: 0,
    };
    moderators.set(entry.moderator, who);
    who[entry.action === "take_down" ? "takeDown" : entry.action] += 1;
    who.total += 1;
    if (entry.action === "take_down") week.takenDown += 1;
    if (entry.action === "ban") {
      week.banned += 1;
      week.takenDown += entry.takenDown ?? 0;
    }
  }

  const pending = jobs.filter((job) => job.status === "pending_review");
  const open = reports.filter((report) => report.status === "open");
  return {
    at: now,
    pendingJobs: pending.length,
    openReports: open.length,
    oldestPendingJobAt: oldest(pending.map((job) => job.postedAt)),
    oldestOpenReportAt: oldest(open.map((report) => report.createdAt)),
    weeks: weeks.map((week) => {
      const { times, ...stats } = rows.get(week)!;
      return { ...stats, medianHandleMs: median(times) };
    }),
    byModerator: [...moderators.values()].sort(
      (a, b) =>
        // Most decisions first; the entries from before #60, which name nobody, last.
        Number(a.moderator === undefined) - Number(b.moderator === undefined) ||
        b.total - a.total ||
        (a.moderator ?? "").localeCompare(b.moderator ?? ""),
    ),
    untimed,
  };
}

/** A wait in words: 刚刚, 25 分钟, 3 小时, 2 天 5 小时. */
export function waitZh(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "不到 1 分钟";
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时`;
  const days = Math.floor(hours / 24);
  return hours % 24 ? `${days} 天 ${hours % 24} 小时` : `${days} 天`;
}
