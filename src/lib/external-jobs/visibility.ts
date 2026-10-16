// When an external job may be shown (#111, ADR 0014). Pure, decided at read time like ADR 0008, so nothing has to run
// at midnight: a job leaves the sections the moment its closing day ends or its last refresh is 2 days old.

/** 先审后显示 (user, 2026-10-17): every imported job waits for a moderator (#112). */
export type ExternalReview = "pending" | "approved" | "hidden";

/**
 * Why a job was taken down: gone from the company's feed, past its closing date, or the company is no longer
 * imported (terms not checked, stopped by a moderator, or the company asked to be removed — #112).
 */
export type ExternalRemovedReason = "gone" | "closed" | "company_off";

export const STALE_AFTER_MS = 2 * 86_400_000;

export interface ShownCheck {
  review: ExternalReview;
  removedAt: string | null;
  lastSeenAt: string;
  closesAt: string | null;
}

/** Approved, still in the feed, refreshed within 2 days, and its closing day not over. */
export function isShown(job: ShownCheck, now: number): boolean {
  return (
    job.review === "approved" &&
    job.removedAt == null &&
    now - Date.parse(job.lastSeenAt) <= STALE_AFTER_MS &&
    (job.closesAt == null || Date.parse(job.closesAt) > now)
  );
}

/** 实习 takes internships and graduate programmes; everything else in the pilot is 专业职位. */
export function sectionOf(kind: string | null): "internship" | "professional" {
  return kind === "internship" || kind === "graduate" ? "internship" : "professional";
}

/** Why a company is not imported (#112): a moderator stopped it, or the company asked to be removed. */
export type ExternalBlockKind = "stopped" | "takedown";
