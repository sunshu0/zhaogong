// The anonymous browser id behind job view counts (#55) and the funnel events (#312, ADR 0025): a random value in an
// httpOnly cookie, stored only hashed (SHA-256 for views, an HMAC with the day for events). No IP and no account.
// Handed out with every page itself (src/proxy.ts; job pages since #79, all pages since #312), so it is in the
// browser before the page records anything. Server Functions never set it (#90): without it a browser counts
// under a throw-away id.

export const VISITOR_COOKIE = "zg_visitor";
const YEAR_SECONDS = 365 * 24 * 3600;

export function isVisitorId(value: string | undefined): value is string {
  return !!value && /^[A-Za-z0-9_-]{22}$/.test(value);
}

/** 16 random bytes, base64url: 22 characters. Web Crypto, so it runs in the proxy and in Server Functions alike. */
export function newVisitorId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function visitorCookieOptions(secure: boolean) {
  return { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: YEAR_SECONDS } as const;
}
