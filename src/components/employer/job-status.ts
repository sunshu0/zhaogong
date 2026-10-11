// Status and expiry of an employer's own jobs. Jobs run 30 days from posting or the last refresh.
import type { Job } from "@/lib/types";

const DAY_MS = 86_400_000;

export const JOB_LIFETIME_DAYS = 30;

export type ShownStatus = Job["status"];

export const STATUS_LABELS: Record<ShownStatus, { zh: string; className: string }> = {
  active: { zh: "招聘中", className: "bg-ok-soft text-ok" },
  pending_review: { zh: "审核中", className: "bg-warn-soft text-warn" },
  expired: { zh: "已过期", className: "border border-border text-muted" },
  removed: { zh: "已下架", className: "bg-danger-soft text-danger" },
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
