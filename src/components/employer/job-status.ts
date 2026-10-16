// Status and expiry of an employer's own jobs. Jobs run 30 days from posting or the last refresh, longer once renewed.
import type { Job } from "@/lib/types";

const DAY_MS = 86_400_000;

export const JOB_LIFETIME_DAYS = 30;

export type ShownStatus = Job["status"];

export const STATUS_LABELS: Record<ShownStatus, { zh: string; className: string }> = {
  active: { zh: "招聘中", className: "border-ok/40 text-ok" },
  pending_review: { zh: "审核中", className: "border-warn/40 text-warn" },
  expired: { zh: "已结束", className: "border-muted/40 text-muted" },
  removed: { zh: "已下架", className: "border-danger text-danger" },
};

/** An active job whose 30 days are up shows as expired, whatever is stored. */
export function effectiveStatus(job: Pick<Job, "status" | "expiresAt">, now: number): ShownStatus {
  return job.status === "active" && Date.parse(job.expiresAt) <= now ? "expired" : job.status;
}

export function daysLeft(job: Pick<Job, "expiresAt">, now: number): number {
  return Math.max(0, Math.ceil((Date.parse(job.expiresAt) - now) / DAY_MS));
}

/** 「N 天后截止」for a live job; for an ended one, how long it may still be renewed (#69). */
export function expiryLabelZh(job: Pick<Job, "status" | "expiresAt">, now: number): string {
  const status = effectiveStatus(job, now);
  if (status === "pending_review") return `审核通过后开始计算 ${JOB_LIFETIME_DAYS} 天`;
  if (status === "active") return untilCloseZh(job, now);
  if (status === "removed") return STATUS_LABELS.removed.zh;
  const left = renewDaysLeft(job, now);
  return left > 0 ? `还可以续期 ${left} 天` : "已不能续期";
}

/** 「今天截止」or 「N 天后截止」. */
export function untilCloseZh(job: Pick<Job, "expiresAt">, now: number): string {
  return Date.parse(job.expiresAt) - now < DAY_MS ? "今天截止" : `${daysLeft(job, now)} 天后截止`;
}

type Dated = Pick<Job, "status" | "postedAt" | "expiresAt">;

/** Taken-down jobs belong to moderation; everything else the employer may edit. */
export function canEdit(job: Pick<Job, "status">): boolean {
  return job.status !== "removed";
}

/** Closing ends a job that is live or waiting for review. */
export function canClose(job: Dated, now: number): boolean {
  const status = effectiveStatus(job, now);
  return status === "active" || status === "pending_review";
}

export const REFRESH_EVERY_MS = DAY_MS;

/**
 * Refresh puts a live job back on top, at most once a day, with at least 30 days to run. An ended job is renewed
 * or published again instead (#69), so refresh no longer reopens one.
 */
export function refreshState(job: Dated, now: number): { allowed: boolean; reason_zh?: string } {
  const status = effectiveStatus(job, now);
  if (status === "removed") return { allowed: false, reason_zh: "已被下架" };
  if (status === "pending_review") return { allowed: false, reason_zh: "审核通过后才能刷新" };
  if (status === "expired") return { allowed: false, reason_zh: "已截止，不能刷新" };
  if (now - Date.parse(job.postedAt) < REFRESH_EVERY_MS) return { allowed: false, reason_zh: "今天已刷新过" };
  return { allowed: true };
}

/**
 * New dates for a refreshed or approved job: on top from now, open for 30 days from now — or until `keepUntil`
 * when that is later, so refreshing a job renewed for 60 days does not cut it short.
 */
export function refreshedDates(now: number, keepUntil?: string): Pick<Job, "postedAt" | "expiresAt"> {
  const until = Math.max(now + JOB_LIFETIME_DAYS * DAY_MS, (keepUntil && Date.parse(keepUntil)) || 0);
  return { postedAt: new Date(now).toISOString(), expiresAt: new Date(until).toISOString() };
}

// ---- closing soon, renewing, publishing again (#69, PRD R-33) ----

/** From this many days before its closing date a live job counts as closing soon, and the employer is told. */
export const ENDING_DAYS = 3;
/** An ended job can be renewed for this many days after its closing date; after that it is published again. */
export const RENEW_WITHIN_DAYS = 14;
export const RENEW_CHOICES = [14, 30, 60] as const;
export type RenewDays = (typeof RENEW_CHOICES)[number];
export const DEFAULT_RENEW_DAYS: RenewDays = 30;
/** A renewed job closes at most this many days from now. */
export const LATEST_CLOSE_DAYS = 90;

/**
 * Where a job stands on 职位管理, one phase per job: live (招聘中, or 将截止 in its last 3 days), waiting for review,
 * ended — 已截止 when its time ran out, 已结束 when the employer ended it — or taken down.
 */
export type Phase = "active" | "ending" | "pending_review" | "timed_out" | "closed" | "removed";

export const PHASE_LABELS: Record<Phase, { zh: string; className: string }> = {
  active: STATUS_LABELS.active,
  ending: { zh: "将截止", className: "border-warn/40 text-warn" },
  pending_review: STATUS_LABELS.pending_review,
  timed_out: { zh: "已截止", className: "border-muted/40 text-muted" },
  closed: STATUS_LABELS.expired,
  removed: STATUS_LABELS.removed,
};

export function jobPhase(job: Pick<Job, "status" | "expiresAt">, now: number): Phase {
  if (job.status === "expired") return "closed";
  if (job.status !== "active") return job.status;
  const left = Date.parse(job.expiresAt) - now;
  return left <= 0 ? "timed_out" : left <= ENDING_DAYS * DAY_MS ? "ending" : "active";
}

/** Whole days left in which an ended job can still be renewed; 0 once it cannot (or while it is not ended). */
export function renewDaysLeft(job: Pick<Job, "status" | "expiresAt">, now: number): number {
  if (effectiveStatus(job, now) !== "expired") return 0;
  const end = Date.parse(job.expiresAt) + RENEW_WITHIN_DAYS * DAY_MS;
  return Math.max(0, Math.ceil((end - now) / DAY_MS));
}

/** The closing date after renewing by `days`: pushed back from the old date, or from now when it has passed. */
export function renewedExpiry(job: Pick<Job, "expiresAt">, now: number, days: number): string {
  return new Date(Math.max(Date.parse(job.expiresAt), now) + days * DAY_MS).toISOString();
}

export type RenewChoice = { days: RenewDays; expiresAt: string; allowed: boolean };

export type RenewState =
  | { allowed: true; choices: RenewChoice[] }
  | { allowed: false; reason_zh: string; /** Ended too long ago: publish it again as a new job. */ republish?: true };

/**
 * Renewing pushes the closing date back by 14, 30 or 60 days without moving the job up the list: before it closes,
 * or up to 14 days after (also after the employer ended it). A choice that would close it more than 90 days from
 * now is not offered.
 */
export function renewState(job: Pick<Job, "status" | "expiresAt">, now: number): RenewState {
  const status = effectiveStatus(job, now);
  if (status === "removed") return { allowed: false, reason_zh: "已被下架" };
  if (status === "pending_review") return { allowed: false, reason_zh: "审核通过后才能续期" };
  if (status === "expired" && renewDaysLeft(job, now) === 0)
    return { allowed: false, reason_zh: `截止超过 ${RENEW_WITHIN_DAYS} 天，不能续期`, republish: true };
  const latest = now + LATEST_CLOSE_DAYS * DAY_MS;
  const choices = RENEW_CHOICES.map((days) => {
    const expiresAt = renewedExpiry(job, now, days);
    return { days, expiresAt, allowed: Date.parse(expiresAt) <= latest };
  });
  if (!choices.some((c) => c.allowed))
    return { allowed: false, reason_zh: `截止日最远到 ${LATEST_CLOSE_DAYS} 天后，现在不用续期` };
  return { allowed: true, choices };
}

/** An ended job can be published again as a new one once it can no longer be renewed. */
export function canRepublish(job: Pick<Job, "status" | "expiresAt">, now: number): boolean {
  const state = renewState(job, now);
  return !state.allowed && state.republish === true;
}

const nzMonthDay = new Intl.DateTimeFormat("zh-CN", { timeZone: "Pacific/Auckland", month: "long", day: "numeric" });

/** 「11月17日」: a closing date as the day it is in New Zealand. */
export function closeDateZh(iso: string): string {
  return nzMonthDay.format(new Date(iso));
}
