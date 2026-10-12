"use server";

import { createEmployer, ensureAccount, getAccount, getAccountEmployer, openEmployerIdentity } from "@/lib/data";
import { openErrorMessage, parseBusinessChoice } from "@/components/seeker/identity";
import { isValidCode, isValidEmail, normalizeEmail } from "@/components/seeker/session";

/** What the server knows about an account; the browser's session copies this and never the other way round. */
export interface AccountStatus {
  email: string;
  employer?: { id: string; name: string };
}

async function statusOf(email: string): Promise<AccountStatus> {
  const account = await ensureAccount(email);
  const employer = await getAccountEmployer(account.email);
  return employer ? { email: account.email, employer: { id: employer.id, name: employer.name } } : { email: account.email };
}

function validEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const normalized = normalizeEmail(email);
  return isValidEmail(normalized) ? normalized : null;
}

/**
 * Sign-up and sign-in are one step: the account is created on first use. Demo: any six-digit code.
 * As elsewhere in the demo, the server trusts the email it is sent; real authentication checks it here.
 */
export async function signInAccount(
  email: string,
  code: string,
): Promise<{ ok: true; account: AccountStatus } | { ok: false; error: string }> {
  const address = validEmail(email);
  if (!address) return { ok: false, error: "请输入正确的邮箱地址" };
  if (typeof code !== "string" || !isValidCode(code)) return { ok: false, error: "请输入 6 位数字验证码" };
  return { ok: true, account: await statusOf(address) };
}

/** The account as the server has it, for the browser to correct its copy (e.g. a business that was banned). */
export async function accountStatus(email: string): Promise<AccountStatus | null> {
  const address = validEmail(email);
  return address ? statusOf(address) : null;
}

/**
 * The employer sign-up step: claim one of the demo businesses or create a new one, then open the account's
 * employer identity for it. An account that already has a business keeps it.
 */
export async function openEmployerForAccount(
  email: string,
  choice: unknown,
): Promise<{ ok: true; employer: { id: string; name: string } } | { ok: false; error: string }> {
  const address = validEmail(email);
  if (!address) return { ok: false, error: "请先登录" };

  const current = await getAccountEmployer(address);
  if (current) return { ok: true, employer: { id: current.id, name: current.name } };
  // A banned business stays linked to its account; no second one from here.
  if ((await getAccount(address))?.employerId) return { ok: false, error: openErrorMessage("banned") };

  const parsed = parseBusinessChoice(choice, "NZ");
  if (!parsed.ok) return parsed;
  const employerId =
    parsed.choice.kind === "existing"
      ? parsed.choice.employerId
      : (await createEmployer({ name: parsed.choice.name, regionId: parsed.choice.regionId })).id;

  const result = await openEmployerIdentity(address, employerId);
  if (!result.ok) return { ok: false, error: openErrorMessage(result.reason) };
  return { ok: true, employer: { id: result.employer.id, name: result.employer.name } };
}
