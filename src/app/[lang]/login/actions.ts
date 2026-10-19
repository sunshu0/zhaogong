"use server";

import {
  AuthError,
  createSession,
  getCurrentSession,
  requestCode,
  signOut,
  switchRole,
  verifyCode,
  type SessionView,
} from "@/lib/auth";
import { CODE_TTL_MS, RESEND_AFTER_MS } from "@/lib/auth/config";
import { cookies } from "next/headers";
import { langOnSignIn } from "@/db/account-lang";
import { langCookieOptions } from "@/i18n/cookie";
import { LANG_COOKIE } from "@/i18n/lang";
import { requestLang } from "@/i18n/server";
import { pick } from "@/i18n/messages";
import { loginMessages } from "@/i18n/messages/login";
import { createEmployer, ensureAccount, getAccount, getAccountEmployer, openEmployerIdentity } from "@/lib/data";
import { openErrorMessage, parseBusinessChoice } from "@/components/seeker/identity";
import { isValidCode, isValidEmail, normalizeCode, normalizeEmail, type ActiveRole } from "@/components/seeker/session";

/**
 * What the server knows about this browser's session. The real session is the httpOnly cookie (src/lib/auth); the
 * browser's copy in localStorage is filled from these answers and corrected by them, never the other way round.
 */
export type AccountStatus = SessionView;

type Failure = { ok: false; error: string };

function validEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const normalized = normalizeEmail(email);
  return isValidEmail(normalized) ? normalized : null;
}

/**
 * Step 1 of 注册或登录: send a code. Outside production the code comes back for the page to show. The answer says
 * when another may be asked for (`resendInSec`), or, asked too soon, how long is left (`retryAfterSec`), for the
 * page to count down on 重新获取验证码 (#184).
 */
export async function requestSignInCode(
  email: string,
): Promise<
  { ok: true; devCode?: string; resendInSec: number; validMinutes: number } | (Failure & { retryAfterSec?: number })
> {
  const lang = await requestLang();
  const t = pick(loginMessages, lang);
  const address = validEmail(email);
  if (!address) return { ok: false, error: t.email.invalid };
  const result = await requestCode(address, new Date(), lang);
  const resendInSec = RESEND_AFTER_MS / 1000;
  const validMinutes = CODE_TTL_MS / 60_000;
  if (result.ok)
    return result.devCode
      ? { ok: true, devCode: result.devCode, resendInSec, validMinutes }
      : { ok: true, resendInSec, validMinutes };
  if (result.reason === "throttled") {
    const { retryAfterSec } = result;
    return { ok: false, error: t.errors.sentRecently(retryAfterSec), retryAfterSec };
  }
  return { ok: false, error: t.errors.noMailService };
}

/**
 * Step 2: check the code and start the session. Sign-up and sign-in are one step: the account is created on first
 * use. `role` is the identity asked for; employer only if the account already has a business.
 */
export async function signInAccount(
  email: string,
  code: string,
  role: ActiveRole = "seeker",
): Promise<{ ok: true; account: AccountStatus; reload?: true } | Failure> {
  const browserLang = await requestLang();
  const t = pick(loginMessages, browserLang);
  const address = validEmail(email);
  if (!address) return { ok: false, error: t.email.invalid };
  // Cleaned before both the check and the verification (#290): " 123 456" passed the check and then failed here.
  const clean = typeof code === "string" ? normalizeCode(code) : "";
  if (!isValidCode(clean)) return { ok: false, error: t.code.invalid };
  const result = await verifyCode(address, clean);
  if (!result.ok) {
    switch (result.reason) {
      case "no_code":
        return { ok: false, error: t.errors.noCode };
      case "expired":
        return { ok: false, error: t.errors.expired };
      case "too_many":
        return { ok: false, error: t.errors.tooManyTries };
      case "wrong":
        return { ok: false, error: t.errors.wrongCode(result.attemptsLeft) };
    }
  }
  await ensureAccount(address);
  const account = await createSession(address, role === "employer" ? "employer" : "seeker");
  // The account's language (Round 20, ADR 0023 §5): it comes back on a new device; an account that never chose takes
  // this browser's. When it differs from the page's, the page has to load again in it (`reload`).
  const lang = await langOnSignIn(address, browserLang);
  if (lang === browserLang) return { ok: true, account };
  (await cookies()).set(LANG_COOKIE, lang, langCookieOptions());
  return { ok: true, account, reload: true };
}

/**
 * The session behind this browser's cookie, or null when signed out. With `email`, also null when the cookie
 * belongs to another account (the browser's copy is out of date).
 */
export async function accountStatus(email?: string): Promise<AccountStatus | null> {
  const session = await getCurrentSession();
  if (!session) return null;
  if (email !== undefined && validEmail(email) !== session.email) return null;
  return session;
}

/**
 * The employer sign-up step for the signed-in account: claim one of the demo businesses or create a new one, open
 * the employer identity for it, and switch the session to it. An account that already has a business keeps it.
 */
export async function openEmployerForAccount(
  email: string,
  choice: unknown,
): Promise<{ ok: true; employer: { id: string; name: string } } | (Failure & { reason?: "taken" })> {
  const lang = await requestLang();
  const session = await accountStatus(typeof email === "string" ? email : "");
  if (!session) return { ok: false, error: pick(loginMessages, lang).errors.signInFirst };
  const address = session.email;

  const current = await getAccountEmployer(address);
  if (!current) {
    // A banned business stays linked to its account; no second one from here.
    if ((await getAccount(address))?.employerId) return { ok: false, error: openErrorMessage("banned", lang) };
    const parsed = parseBusinessChoice(choice, "NZ", lang);
    if (!parsed.ok) return parsed;
    const employerId =
      parsed.choice.kind === "existing"
        ? parsed.choice.employerId
        : (await createEmployer({ name: parsed.choice.name, regionId: parsed.choice.regionId })).id;
    const opened = await openEmployerIdentity(address, employerId);
    if (!opened.ok) {
      const error = openErrorMessage(opened.reason, lang);
      return opened.reason === "taken" ? { ok: false, error, reason: "taken" } : { ok: false, error };
    }
  }
  const switched = await switchRole("employer");
  return { ok: true, employer: switched.employer! };
}

/** Switches the active identity on the server; employer only if the account has a business. Null when signed out. */
export async function switchIdentity(role: ActiveRole): Promise<AccountStatus | null> {
  try {
    return await switchRole(role === "employer" ? "employer" : "seeker");
  } catch (e) {
    if (e instanceof AuthError) return null;
    throw e;
  }
}

export async function signOutAccount(): Promise<void> {
  await signOut();
}
