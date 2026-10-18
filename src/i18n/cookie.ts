// The zg_lang cookie's settings (ADR 0023 §5): a year, the whole site, httpOnly (the page knows its language from
// the server; no script needs the cookie), Secure in production. Server only, used by the switch and at sign-in.
import { isProduction } from "@/lib/auth/config";

export const LANG_COOKIE_MAX_AGE = 365 * 24 * 3600;

export function langCookieOptions(production = isProduction()) {
  return {
    maxAge: LANG_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax" as const,
    httpOnly: true,
    secure: production,
  };
}
