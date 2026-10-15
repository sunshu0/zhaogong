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
import { createEmployer, ensureAccount, getAccount, getAccountEmployer, openEmployerIdentity } from "@/lib/data";
import { openErrorMessage, parseBusinessChoice } from "@/components/seeker/identity";
import { isValidCode, isValidEmail, normalizeEmail, type ActiveRole } from "@/components/seeker/session";

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

/** Step 1 of 注册或登录: send a code. Outside production the code comes back for the page to show. */
export async function requestSignInCode(email: string): Promise<{ ok: true; devCode?: string } | Failure> {
  const address = validEmail(email);
  if (!address) return { ok: false, error: "请输入正确的邮箱地址" };
  const result = await requestCode(address);
  if (result.ok) return result.devCode ? { ok: true, devCode: result.devCode } : { ok: true };
  if (result.reason === "throttled") return { ok: false, error: `验证码刚发过，请 ${result.retryAfterSec} 秒后再获取` };
  return { ok: false, error: "邮件服务还没有配置，暂时无法发送验证码" };
}

/**
 * Step 2: check the code and start the session. Sign-up and sign-in are one step: the account is created on first
 * use. `role` is the identity asked for; employer only if the account already has a business.
 */
export async function signInAccount(
  email: string,
  code: string,
  role: ActiveRole = "seeker",
): Promise<{ ok: true; account: AccountStatus } | Failure> {
  const address = validEmail(email);
  if (!address) return { ok: false, error: "请输入正确的邮箱地址" };
  if (typeof code !== "string" || !isValidCode(code)) return { ok: false, error: "请输入 6 位数字验证码" };
  const result = await verifyCode(address, code);
  if (!result.ok) {
    switch (result.reason) {
      case "no_code":
        return { ok: false, error: "请先获取验证码" };
      case "expired":
        return { ok: false, error: "验证码已过期，请重新获取" };
      case "too_many":
        return { ok: false, error: "错误次数太多，请重新获取验证码" };
      case "wrong":
        return { ok: false, error: `验证码不对，还可以再试 ${result.attemptsLeft} 次` };
    }
  }
  await ensureAccount(address);
  return { ok: true, account: await createSession(address, role === "employer" ? "employer" : "seeker") };
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
): Promise<{ ok: true; employer: { id: string; name: string } } | Failure> {
  const session = await accountStatus(typeof email === "string" ? email : "");
  if (!session) return { ok: false, error: "请先登录" };
  const address = session.email;

  const current = await getAccountEmployer(address);
  if (!current) {
    // A banned business stays linked to its account; no second one from here.
    if ((await getAccount(address))?.employerId) return { ok: false, error: openErrorMessage("banned") };
    const parsed = parseBusinessChoice(choice, "NZ");
    if (!parsed.ok) return parsed;
    const employerId =
      parsed.choice.kind === "existing"
        ? parsed.choice.employerId
        : (await createEmployer({ name: parsed.choice.name, regionId: parsed.choice.regionId })).id;
    const opened = await openEmployerIdentity(address, employerId);
    if (!opened.ok) return { ok: false, error: openErrorMessage(opened.reason) };
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
