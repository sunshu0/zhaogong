// Where sign-in codes go. There is no mail service yet (that needs the user's account with a provider):
// in development and the browser tests' build (#139) the code is printed to the server log and shown on the sign-in
// page; in production, sign-in refuses until a mailer is added here.
import { CODE_TTL_MS } from "@/lib/auth/config";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { loginMessages } from "@/i18n/messages/login";
import { devHelpersEnabled } from "@/lib/test-build";

/** Whether codes can be delivered at all in this environment. */
export function canSendCodes(): boolean {
  return devHelpersEnabled();
}

/** The sign-in code email in the language of the request that asked for it (Round 20), for the mailer to send. */
export function signInCodeMail(code: string, lang: Lang = DEFAULT_LANG): { subject: string; text: string } {
  const t = pick(loginMessages, lang).mail;
  return { subject: t.subject(code), text: t.body(code, CODE_TTL_MS / 60_000) };
}

/** Sends a sign-in code. Callers check canSendCodes() first. */
export async function sendSignInCode(email: string, code: string, lang: Lang = DEFAULT_LANG): Promise<void> {
  if (!devHelpersEnabled()) {
    throw new Error("No mail service is configured; sign-in codes cannot be sent in production.");
  }
  console.info(`[auth] 开发模式验证码 ${email}: ${code} — ${signInCodeMail(code, lang).subject}`);
}
