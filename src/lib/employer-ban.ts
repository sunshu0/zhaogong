// Employer bans (ADR 0044): permanent (bannedAt, no bannedUntil) or temporary (both, until bannedUntil). A temporary
// ban ends by itself when its time comes: nothing is written then, every reader asks isBanned with the time it has.
import type { Employer } from "@/lib/types";

export type BanFields = Pick<Employer, "bannedAt" | "bannedUntil">;

// The ban fields read in the browser are only ever `bannedAt` (banned now, after currentBan), `bannedUntil` and
// `banReason` (shown on the notice); the time is read on the server.

/** The lengths a moderator can pick for a temporary ban, in days. */
export const TEMP_BAN_DAYS = [3, 7, 30] as const;
export type TempBanDays = (typeof TEMP_BAN_DAYS)[number];

/** Longest reason a moderator can give, in characters. */
export const BAN_REASON_MAX = 200;

const DAY_MS = 86_400_000;

/** Whether the business is banned at `now` (ms): a permanent ban, or a temporary one not yet over. */
export function isBanned(employer: BanFields | undefined | null, now: number): boolean {
  if (!employer?.bannedAt) return false;
  return !employer.bannedUntil || Date.parse(employer.bannedUntil) > now;
}

/** Whether the ban is permanent (temporary bans, over or not, are not). */
export function isPermanentBan(employer: BanFields | undefined | null): boolean {
  return Boolean(employer?.bannedAt) && !employer?.bannedUntil;
}

/** The end of a temporary ban still running at `now`, or undefined (not banned, permanent, or over). */
export function tempBanEnd(employer: BanFields | undefined | null, now: number): string | undefined {
  return isBanned(employer, now) && employer?.bannedUntil ? employer.bannedUntil : undefined;
}

/**
 * The business as it stands at `now`: a temporary ban that is over is dropped. Nothing is written when a ban ends, so
 * the server passes a business through this before handing it to the browser, where `bannedAt` then means banned now.
 */
export function currentBan<T extends BanFields>(employer: T, now: number): T;
export function currentBan<T extends BanFields>(employer: T | undefined, now: number): T | undefined;
export function currentBan<T extends BanFields>(employer: T | undefined, now: number): T | undefined {
  if (!employer?.bannedAt || isBanned(employer, now)) return employer;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- dropped on purpose
  const { bannedAt, bannedUntil, banReason, ...rest } = employer as T & Pick<Employer, "banReason">;
  return rest as T;
}

/** When a temporary ban of `days` starting at `now` ends, as stored. */
export function tempBanUntil(now: number, days: TempBanDays): string {
  return new Date(now + days * DAY_MS).toISOString();
}

export function isTempBanDays(days: unknown): days is TempBanDays {
  return TEMP_BAN_DAYS.includes(days as TempBanDays);
}
