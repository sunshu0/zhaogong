// How often sign-in codes may be asked for and checked (ADR 0033), on top of one code a minute per email and five
// tries per code. Counted per network address (the visitor's IP, from Cloudflare), per email, and for the whole
// site, in fixed windows. A count is a row in auth_limits under a keyed hash of what it counts, so the table holds
// no address or email in the clear, and a row goes when its window ends. Server only.
import { createHmac } from "node:crypto";
import { authSecret } from "@/lib/auth/config";
import { devHelpersEnabled } from "@/lib/test-build";

const HOUR = 3600_000;

/** What is counted, at most how many in each window. The numbers and why: ADR 0033. */
export const LIMITS = {
  /** Codes asked for from one IP in an hour: a shared office or café stays well under it, a script does not. */
  ipCodes: { scope: "ip", max: 20, windowMs: HOUR },
  /** Codes checked from one IP in an hour. */
  ipChecks: { scope: "ip", max: 60, windowMs: HOUR },
  /** Codes sent to one email in 24 hours: stops using the form to flood someone's inbox. */
  emailCodes: { scope: "email", max: 10, windowMs: 24 * HOUR },
  /** Codes checked for one email in 24 hours, right or wrong: with five tries a code, at most 20 guesses a day. */
  emailChecks: { scope: "email", max: 20, windowMs: 24 * HOUR },
  /** Every code the site sends in an hour: a fuse for the mail service's bill and reputation. */
  siteCodes: { scope: "site", max: 300, windowMs: HOUR },
} as const;

export type LimitName = keyof typeof LIMITS;
export type LimitScope = (typeof LIMITS)[LimitName]["scope"];

/** One count to take: which limit, and whose (the IP or the email; nothing for the site). */
export type LimitCheck = { name: LimitName; subject?: string };

/** Where a count goes: its row's key, when the row may go, and how long until the window starts over. */
export function limitWindow(name: LimitName, subject: string, now: Date) {
  const { windowMs } = LIMITS[name];
  const start = Math.floor(now.getTime() / windowMs) * windowMs;
  const end = start + windowMs;
  return {
    key: createHmac("sha256", authSecret()).update(`limit\n${name}\n${subject}\n${start}`).digest("hex"),
    expiresAt: new Date(end).toISOString(),
    retryAfterSec: Math.max(1, Math.ceil((end - now.getTime()) / 1000)),
  };
}

/**
 * The site-wide fuse guards a real mail service. Development and the browser tests' build send no mail (the code
 * is printed and shown), and a full browser run asks for hundreds of codes an hour, so it is off there.
 */
export function siteFuseOn(devHelpers = devHelpersEnabled()): boolean {
  return !devHelpers;
}

/**
 * The visitor's IP as Cloudflare passes it on (`CF-Connecting-IP`, which Cloudflare sets itself and a visitor
 * cannot), or undefined when there is none (local development, the browser tests) or it does not look like one.
 */
export function clientIp(header: string | null | undefined): string | undefined {
  const value = header?.trim();
  return value && value.length <= 45 && /^[0-9a-fA-F:.]+$/.test(value) ? value.toLowerCase() : undefined;
}
