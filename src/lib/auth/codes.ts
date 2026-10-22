// One-time sign-in codes: six random digits, stored as an HMAC, one live code per email.
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { authStore, type AuthStore } from "@/lib/auth/store";
import { LIMITS, limitWindow, siteFuseOn, type LimitCheck, type LimitScope } from "@/lib/auth/limits";
import { authSecret, CODE_TTL_MS, MAX_ATTEMPTS, RESEND_AFTER_MS } from "@/lib/auth/config";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { canSendCodes, sendSignInCode } from "@/lib/auth/delivery";
import { devHelpersEnabled } from "@/lib/test-build";
import { normalizeEmail } from "@/components/seeker/session";

export type RequestCodeResult =
  | {
      ok: true;
      /** Only outside production (and in the browser tests' build, #139), for the sign-in page to show. */ devCode?: string;
    }
  | { ok: false; reason: "throttled"; retryAfterSec: number }
  | Limited
  | { ok: false; reason: "no_mailer" };

export type VerifyCodeResult =
  | { ok: true }
  | { ok: false; reason: "no_code" | "expired" | "too_many" }
  | Limited
  | { ok: false; reason: "wrong"; attemptsLeft: number };

/** Over one of the limits of ADR 0033: whose (this network, this email, the whole site), and until when. */
export type Limited = { ok: false; reason: "limited"; scope: LimitScope; retryAfterSec: number };

/**
 * Takes one count of each limit in order, in one database step each; the first that is full refuses. Counts taken
 * before it stay taken: whoever keeps hitting a full limit uses up the others too.
 */
export async function takeLimits(store: AuthStore, checks: LimitCheck[], now: Date): Promise<Limited | undefined> {
  for (const { name, subject } of checks) {
    const window = limitWindow(name, subject ?? "", now);
    if (!(await store.takeLimit(window.key, LIMITS[name].max, window.expiresAt))) {
      return { ok: false, reason: "limited", scope: LIMITS[name].scope, retryAfterSec: window.retryAfterSec };
    }
  }
}

/** Who is asking: the visitor's IP when Cloudflare passed it on (limits.ts clientIp). */
export type Asker = { ip?: string };

export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** HMAC-SHA256 of the email and code with AUTH_SECRET, hex. */
export function hashCode(email: string, code: string): string {
  return createHmac("sha256", authSecret())
    .update(`${normalizeEmail(email)}\n${code}`)
    .digest("hex");
}

function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Creates a code for the email (replacing any older one) and sends it; at most once a minute per email, and within
 * the limits of ADR 0033 for the asker's network, the email and the whole site.
 */
export async function requestCode(
  email: string,
  now = new Date(),
  lang: Lang = DEFAULT_LANG,
  asker: Asker = {},
): Promise<RequestCodeResult> {
  if (!canSendCodes()) return { ok: false, reason: "no_mailer" };
  const address = normalizeEmail(email);
  const store = authStore();
  const existing = await store.getCode(address);
  if (existing) {
    const wait = RESEND_AFTER_MS - (now.getTime() - Date.parse(existing.createdAt));
    if (wait > 0) return { ok: false, reason: "throttled", retryAfterSec: Math.ceil(wait / 1000) };
  }
  await store.clearEndedLimits(now.toISOString());
  const limited = await takeLimits(
    store,
    [
      ...(asker.ip ? [{ name: "ipCodes", subject: asker.ip } as const] : []),
      { name: "emailCodes", subject: address },
      ...(siteFuseOn() ? [{ name: "siteCodes" } as const] : []),
    ],
    now,
  );
  if (limited) return limited;

  const code = generateCode();
  await store.putCode({
    email: address,
    codeHash: hashCode(address, code),
    expiresAt: new Date(now.getTime() + CODE_TTL_MS).toISOString(),
    attempts: 0,
    createdAt: now.toISOString(),
  });
  await sendSignInCode(address, code, lang);
  return devHelpersEnabled() ? { ok: true, devCode: code } : { ok: true };
}

/**
 * Checks a code. Right: the code is used up. Wrong: one try fewer; after five the code stops working but is kept
 * until it is replaced, so the once-a-minute limit on new codes still applies. Each check first takes a try in one
 * database step (takeCodeAttempt), so many guesses sent at once still get five tries between them, and the right
 * code signs in once (useCode).
 */
export async function verifyCode(
  email: string,
  code: string,
  now = new Date(),
  asker: Asker = {},
): Promise<VerifyCodeResult> {
  const address = normalizeEmail(email);
  const store = authStore();
  const row = await store.getCode(address);
  if (!row) return { ok: false, reason: "no_code" };
  if (Date.parse(row.expiresAt) <= now.getTime()) {
    await store.deleteCode(address);
    return { ok: false, reason: "expired" };
  }
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "too_many" };
  // ADR 0033: checks per network and per email, counted before the code's own try, right or wrong.
  await store.clearEndedLimits(now.toISOString());
  const limited = await takeLimits(
    store,
    [
      ...(asker.ip ? [{ name: "ipChecks", subject: asker.ip } as const] : []),
      { name: "emailChecks", subject: address },
    ],
    now,
  );
  if (limited) return limited;

  const counted = await store.takeCodeAttempt(address, MAX_ATTEMPTS, now.toISOString());
  if (!counted) {
    // Other checks took the last tries, or the code went (used, expired or replaced) since it was read.
    const again = await store.getCode(address);
    return { ok: false, reason: !again ? "no_code" : again.attempts >= MAX_ATTEMPTS ? "too_many" : "expired" };
  }
  const given = String(code ?? "").trim();
  if (/^[0-9]{6}$/.test(given) && sameHash(hashCode(address, given), counted.codeHash)) {
    return (await store.useCode(address, counted.codeHash)) ? { ok: true } : { ok: false, reason: "no_code" };
  }
  const attempts = counted.attempts;
  return attempts >= MAX_ATTEMPTS
    ? { ok: false, reason: "too_many" }
    : { ok: false, reason: "wrong", attemptsLeft: MAX_ATTEMPTS - attempts };
}
