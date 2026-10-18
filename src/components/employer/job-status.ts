// Status and expiry of an employer's own jobs. Jobs run 30 days from posting or the last refresh, longer once renewed.
// Round 20 (ADR 0023): the wording comes from the employer-jobs dictionary. Every function that builds text takes a
// trailing `lang`, Chinese by default, so callers that have no language yet keep the text they had.
import { formatDate } from "@/i18n/format";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { employerJobsMessages } from "@/i18n/messages/employer-jobs";
import type { Job } from "@/lib/types";

const DAY_MS = 86_400_000;

const words = (lang: Lang) => pick(employerJobsMessages, lang).status;

export const JOB_LIFETIME_DAYS = 30;

export type ShownStatus = Job["status"];

/** Which word of `status.tag` a tag shows. */
export type StatusTagKey = "active" | "pendingReview" | "expired" | "removed" | "ending" | "timedOut";

/** A status as a tag: the dictionary key for its word, and the colour that says the status. */
export const STATUS_LABELS: Record<ShownStatus, { key: StatusTagKey; className: string }> = {
  active: { key: "active", className: "border-ok/40 text-ok" },
  pending_review: { key: "pendingReview", className: "border-warn/40 text-warn" },
  expired: { key: "expired", className: "border-muted/40 text-muted" },
  removed: { key: "removed", className: "border-danger text-danger" },
};

/** An active job whose 30 days are up shows as expired, whatever is stored. */
export function effectiveStatus(job: Pick<Job, "status" | "expiresAt">, now: number): ShownStatus {
  return job.status === "active" && Date.parse(job.expiresAt) <= now ? "expired" : job.status;
}

export function daysLeft(job: Pick<Job, "expiresAt">, now: number): number {
  return Math.max(0, Math.ceil((Date.parse(job.expiresAt) - now) / DAY_MS));
}

/** 「N 天后截止」for a live job; for an ended one, how long it may still be renewed (#69). */
export function expiryLabelZh(job: Pick<Job, "status" | "expiresAt">, now: number, lang: Lang = DEFAULT_LANG): string {
  const t = words(lang);
  const status = effectiveStatus(job, now);
  if (status === "pending_review") return t.expiry.pendingReview(JOB_LIFETIME_DAYS);
  if (status === "active") return untilCloseZh(job, now, lang);
  if (status === "removed") return t.tag.removed;
  const left = renewDaysLeft(job, now);
  return left > 0 ? t.expiry.renewableFor(left) : t.expiry.noLongerRenewable;
}

/** 「今天截止」or 「N 天后截止」. */
export function untilCloseZh(job: Pick<Job, "expiresAt">, now: number, lang: Lang = DEFAULT_LANG): string {
  const t = words(lang).expiry;
  return Date.parse(job.expiresAt) - now < DAY_MS ? t.closesToday : t.closesInDays(daysLeft(job, now));
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
export function refreshState(
  job: Dated,
  now: number,
  lang: Lang = DEFAULT_LANG,
): { allowed: boolean; reason_zh?: string } {
  const t = words(lang).refresh;
  const status = effectiveStatus(job, now);
  if (status === "removed") return { allowed: false, reason_zh: t.removed };
  if (status === "pending_review") return { allowed: false, reason_zh: t.pendingReview };
  if (status === "expired") return { allowed: false, reason_zh: t.expired };
  if (now - Date.parse(job.postedAt) < REFRESH_EVERY_MS) return { allowed: false, reason_zh: t.today };
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

export const PHASE_LABELS: Record<Phase, { key: StatusTagKey; className: string }> = {
  active: STATUS_LABELS.active,
  ending: { key: "ending", className: "border-warn/40 text-warn" },
  pending_review: STATUS_LABELS.pending_review,
  timed_out: { key: "timedOut", className: "border-muted/40 text-muted" },
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
export function renewState(job: Pick<Job, "status" | "expiresAt">, now: number, lang: Lang = DEFAULT_LANG): RenewState {
  const t = words(lang).renew;
  const status = effectiveStatus(job, now);
  if (status === "removed") return { allowed: false, reason_zh: t.removed };
  if (status === "pending_review") return { allowed: false, reason_zh: t.pendingReview };
  if (status === "expired" && renewDaysLeft(job, now) === 0)
    return { allowed: false, reason_zh: t.tooLate(RENEW_WITHIN_DAYS), republish: true };
  const latest = now + LATEST_CLOSE_DAYS * DAY_MS;
  const choices = RENEW_CHOICES.map((days) => {
    const expiresAt = renewedExpiry(job, now, days);
    return { days, expiresAt, allowed: Date.parse(expiresAt) <= latest };
  });
  if (!choices.some((c) => c.allowed)) return { allowed: false, reason_zh: t.farEnough(LATEST_CLOSE_DAYS) };
  return { allowed: true, choices };
}

/** An ended job can be published again as a new one once it can no longer be renewed. */
/**
 * 复制为新职位 (#190): a job that is live or ended can start a new one with its content. One taken down by moderation
 * cannot, nor one still waiting for review.
 */
export function canCopy(job: Pick<Job, "status">): boolean {
  return job.status === "active" || job.status === "expired";
}

export function canRepublish(job: Pick<Job, "status" | "expiresAt">, now: number): boolean {
  const state = renewState(job, now);
  return !state.allowed && state.republish === true;
}

/** 「11月17日」/「17 Nov」: a closing date as the day it is in New Zealand. */
export function closeDateZh(iso: string, lang: Lang = DEFAULT_LANG): string {
  return formatDate(iso, lang, { month: "short", day: "numeric" });
}
