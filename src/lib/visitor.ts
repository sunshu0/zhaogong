// The anonymous browser id behind job view counts (#55): a random value in an httpOnly cookie, stored only hashed.
// No IP and no account. Handed out with the job page itself (src/proxy.ts, #79), so it is in the browser before
// the page counts the view; the view count makes one only when a browser arrives without it.

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
