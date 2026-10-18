// One-time sign-in codes: six random digits, stored as an HMAC, one live code per email.
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { authStore } from "@/lib/auth/store";
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
  | { ok: false; reason: "no_mailer" };

export type VerifyCodeResult =
  | { ok: true }
  | { ok: false; reason: "no_code" | "expired" | "too_many" }
  | { ok: false; reason: "wrong"; attemptsLeft: number };

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

/** Creates a code for the email (replacing any older one) and sends it; at most once a minute per email. */
export async function requestCode(
  email: string,
  now = new Date(),
  lang: Lang = DEFAULT_LANG,
): Promise<RequestCodeResult> {
  if (!canSendCodes()) return { ok: false, reason: "no_mailer" };
  const address = normalizeEmail(email);
  const store = authStore();
  const existing = await store.getCode(address);
  if (existing) {
    const wait = RESEND_AFTER_MS - (now.getTime() - Date.parse(existing.createdAt));
    if (wait > 0) return { ok: false, reason: "throttled", retryAfterSec: Math.ceil(wait / 1000) };
  }

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
 * until it is replaced, so the once-a-minute limit on new codes still applies.
 */
export async function verifyCode(email: string, code: string, now = new Date()): Promise<VerifyCodeResult> {
  const address = normalizeEmail(email);
  const store = authStore();
  const row = await store.getCode(address);
  if (!row) return { ok: false, reason: "no_code" };
  if (Date.parse(row.expiresAt) <= now.getTime()) {
    await store.deleteCode(address);
    return { ok: false, reason: "expired" };
  }
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "too_many" };

  const given = String(code ?? "").trim();
  if (/^[0-9]{6}$/.test(given) && sameHash(hashCode(address, given), row.codeHash)) {
    await store.deleteCode(address);
    return { ok: true };
  }
  const attempts = row.attempts + 1;
  await store.setCodeAttempts(address, attempts);
  return attempts >= MAX_ATTEMPTS
    ? { ok: false, reason: "too_many" }
    : { ok: false, reason: "wrong", attemptsLeft: MAX_ATTEMPTS - attempts };
}
