// Status and expiry of an employer's own jobs. Jobs run 30 days from posting or the last refresh.
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

export function expiryLabelZh(job: Pick<Job, "status" | "expiresAt">, now: number): string {
  const status = effectiveStatus(job, now);
  if (status === "pending_review") return `审核通过后开始计算 ${JOB_LIFETIME_DAYS} 天`;
  if (status !== "active") return STATUS_LABELS[status].zh;
  return Date.parse(job.expiresAt) - now < DAY_MS ? "今天到期" : `还有 ${daysLeft(job, now)} 天到期`;
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

/** Refresh puts a job back on top for another 30 days, at most once a day; it also reopens an ended job. */
export function refreshState(job: Dated, now: number): { allowed: boolean; reason_zh?: string } {
  const status = effectiveStatus(job, now);
  if (status === "removed") return { allowed: false, reason_zh: "已被下架" };
  if (status === "pending_review") return { allowed: false, reason_zh: "审核通过后才能刷新" };
  if (status === "active" && now - Date.parse(job.postedAt) < REFRESH_EVERY_MS)
    return { allowed: false, reason_zh: "今天已刷新过" };
  return { allowed: true };
}

/** New dates for a refreshed job. */
export function refreshedDates(now: number): Pick<Job, "postedAt" | "expiresAt"> {
  return { postedAt: new Date(now).toISOString(), expiresAt: new Date(now + JOB_LIFETIME_DAYS * DAY_MS).toISOString() };
}
