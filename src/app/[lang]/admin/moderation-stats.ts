// 审核数据 (#70, PRD R-34): what the moderation queue looks like now, and the last eight weeks of reports and
// decisions. Pure, so the numbers are tested without a database; stats-actions.ts feeds it on the server. The data
// is small, so it is worked out from whole tables on each request (ADR 0010 says what to do when it is not).
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { adminStatsMessages } from "@/i18n/messages/admin-stats";
import type { Job, ModerationLogEntry, Report } from "@/lib/types";
import type { AiUsageResult } from "@/lib/ai-post/model/limits";

export const WEEKS = 8;
/** AI 发帖用量 covers the last seven New Zealand days, today included. */
export const AI_DAYS = 7;
const DAY_MS = 86_400_000;
const nzDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Auckland" });

/** The day in New Zealand, YYYY-MM-DD. */
export function nzDay(at: number): string {
  return nzDate.format(at);
}

/** The last `n` New Zealand days up to `now`, today first. */
export function lastDays(now: number, n = AI_DAYS): string[] {
  const days = new Set<string>();
  // Step back in hours rather than days, so a daylight-saving change cannot skip or repeat a day.
  for (let h = 0; days.size < n; h += 1) days.add(nzDay(now - h * 3_600_000));
  return [...days];
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
  /** 企业验证 decisions, approved or rejected (#78). */
  verify: number;
  /** External jobs shown or hidden, and companies stopped, resumed or removed (#112). */
  external: number;
  total: number;
};

/** One New Zealand day of calls to the AI 发帖 model (#102). */
export type AiDayStats = {
  /** YYYY-MM-DD in New Zealand; "total" for the seven days together. */
  day: string;
  /** Calls made to the model, failed ones included. */
  calls: number;
  /** Input, output and cache tokens together. */
  tokens: number;
  /** Calls that gave no usable answer: an error, a refusal or an answer that could not be read. */
  failed: number;
  /** Calls the limits turned away (not made, not in `calls`). */
  limited: number;
};

/** What the AI 发帖 model is asked, as ai_usage keeps it (src/db/ai-usage.ts). */
export type AiUsageEntry = {
  at: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  result: AiUsageResult;
};

export type ModerationStats = {
  /** When these numbers were worked out (the server's clock), to say how long the oldest items have waited. */
  at: number;
  pendingJobs: number;
  openReports: number;
  /** When the oldest job waiting for review was posted, and the oldest open report made. */
  oldestPendingJobAt?: string;
  oldestOpenReportAt?: string;
  /** 企业验证 applications waiting (#78), and when the oldest was made. */
  pendingVerifications: number;
  oldestPendingVerificationAt?: string;
  /** External jobs waiting for review (#112), and when the oldest was first imported. */
  pendingExternal: number;
  oldestPendingExternalAt?: string;
  /** This week first. */
  weeks: WeekStats[];
  /** Decisions per moderator over the same eight weeks, most first. */
  byModerator: ModeratorStats[];
  /** Closed reports without a closing time: closed before closing times were kept (migration 0008). */
  untimed: number;
  /** AI 发帖用量 (#102): the last seven days, today first, and the seven together. */
  aiPosting: { days: AiDayStats[]; total: AiDayStats };
};

/** The column a log entry counts under in 按审核员. */
function decisionKey(
  action: ModerationLogEntry["action"],
): "approve" | "takeDown" | "dismiss" | "ban" | "verify" | "external" {
  if (action === "take_down") return "takeDown";
  if (action === "verify_approve" || action === "verify_reject") return "verify";
  if (action.startsWith("external_")) return "external";
  return action as "approve" | "dismiss" | "ban";
}

const oldest = (dates: string[]) => (dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : undefined);

export function moderationStats(
  {
    jobs,
    reports,
    log,
    verifications = [],
    externalPending = [],
    aiUsage = [],
  }: {
    jobs: readonly Job[];
    reports: readonly Report[];
    log: readonly ModerationLogEntry[];
    /** The 企业验证 applications waiting (#78). */
    verifications?: readonly { submittedAt: string }[];
    /** The external jobs waiting for review (#112). */
    externalPending?: readonly { firstSeenAt: string }[];
    /** Calls to the AI 发帖 model (#102); older than seven days are left out here. */
    aiUsage?: readonly AiUsageEntry[];
  },
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
      verify: 0,
      external: 0,
      total: 0,
    };
    moderators.set(entry.moderator, who);
    who[decisionKey(entry.action)] += 1;
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
    pendingVerifications: verifications.length,
    oldestPendingVerificationAt: oldest(verifications.map((v) => v.submittedAt)),
    pendingExternal: externalPending.length,
    oldestPendingExternalAt: oldest(externalPending.map((j) => j.firstSeenAt)),
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
    aiPosting: aiPostingStats(aiUsage, now),
  };
}

function aiPostingStats(entries: readonly AiUsageEntry[], now: number): ModerationStats["aiPosting"] {
  const empty = (day: string): AiDayStats => ({ day, calls: 0, tokens: 0, failed: 0, limited: 0 });
  const days = new Map(lastDays(now).map((day) => [day, empty(day)]));
  const total = empty("total");
  for (const entry of entries) {
    const day = days.get(nzDay(Date.parse(entry.at)));
    if (!day) continue;
    for (const row of [day, total]) {
      if (entry.result === "limited") {
        row.limited += 1;
        continue;
      }
      row.calls += 1;
      row.tokens += entry.input + entry.output + entry.cacheRead + entry.cacheWrite;
      if (entry.result !== "ok") row.failed += 1;
    }
  }
  return { days: [...days.values()], total };
}

/** A wait in words, rounded down: 不到 1 分钟 / under a minute, 25 分钟, 3 小时, 2 天 5 小时 / 2 days 5 hours. */
export function waitText(ms: number, lang: Lang = DEFAULT_LANG): string {
  const t = pick(adminStatsMessages, lang).wait;
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return t.underAMinute;
  if (minutes < 60) return t.minutes(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t.hours(hours);
  const days = Math.floor(hours / 24);
  return hours % 24 ? t.daysHours(days, hours % 24) : t.days(days);
}
