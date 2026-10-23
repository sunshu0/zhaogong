// Settings for sign-in and sessions. Server only.

/** A sign-in code works for 10 minutes. */
export const CODE_TTL_MS = 10 * 60_000;
/** Wrong codes allowed before a code stops working. */
export const MAX_ATTEMPTS = 5;
/** One code per email per minute. */
export const RESEND_AFTER_MS = 60_000;
/**
 * An expired code stays this long before the clean-up deletes it (security review H), so checking it late still
 * says 「验证码已过期」 rather than that there is none.
 */
export const EXPIRED_CODE_KEPT_MS = 24 * 3600_000;

/**
 * The session cookie's name. In production `__Host-zg_session` (security review I, 10-23): the browser then keeps it
 * only when it is Secure, Path=/ and without Domain, so no subdomain can set or replace it. Development and the unit
 * tests run on plain http and use `zg_session`. The test build is production, and Chromium treats http://localhost as
 * secure, so the browser tests use the production name. Renaming it after launch would sign everyone out.
 */
export function sessionCookieName(production = isProduction()): string {
  return production ? "__Host-zg_session" : "zg_session";
}
/** Sessions last 30 days. */
export const SESSION_TTL_MS = 30 * 24 * 3600_000;

/** Used only outside production, so local development and tests work without setting anything. */
const DEVELOPMENT_SECRET = "zhaogong-local-development-only";

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** The HMAC key for sign-in codes. Production refuses to run without a real one. */
export function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (secret) return secret;
  if (isProduction()) throw new Error("AUTH_SECRET is not set: sign-in codes cannot be checked without it.");
  return DEVELOPMENT_SECRET;
}
