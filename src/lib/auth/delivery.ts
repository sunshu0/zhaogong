// Where sign-in codes go. In development and the browser tests' build (#139) the code is printed to the server log
// and shown on the sign-in page, and nothing is mailed. In production the code is mailed through Amazon SES (#16,
// ADR 0032) once its four settings are there; without them sign-in refuses, as before.
import { CODE_TTL_MS } from "@/lib/auth/config";
import { sesConfig, sendSesEmail } from "@/lib/auth/ses";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { loginMessages } from "@/i18n/messages/login";
import { devHelpersEnabled } from "@/lib/test-build";

/** Whether codes can be delivered at all in this environment. */
export function canSendCodes(): boolean {
  return devHelpersEnabled() || sesConfig() !== undefined;
}

/** The sign-in code email in the language of the request that asked for it (Round 20), for the mailer to send. */
export function signInCodeMail(code: string, lang: Lang = DEFAULT_LANG): { subject: string; text: string } {
  const t = pick(loginMessages, lang).mail;
  return { subject: t.subject(code), text: t.body(code, CODE_TTL_MS / 60_000) };
}

/**
 * Sends a sign-in code; false when it could not be sent (the page then says to try again later). Callers check
 * canSendCodes() first. `fetchImpl` is for the tests.
 */
export async function sendSignInCode(
  email: string,
  code: string,
  lang: Lang = DEFAULT_LANG,
  fetchImpl?: typeof fetch,
): Promise<boolean> {
  const mail = signInCodeMail(code, lang);
  if (devHelpersEnabled()) {
    console.info(`[auth] 开发模式验证码 ${email}: ${code} — ${mail.subject}`);
    return true;
  }
  const config = sesConfig();
  if (!config) throw new Error("No mail service is configured; sign-in codes cannot be sent in production.");
  const sent = await sendSesEmail(config, { to: email, ...mail }, fetchImpl);
  // The log gets SES's answer, never the address or the code.
  if (!sent.ok) console.error(`[auth] sign-in code not sent: SES ${sent.status} ${sent.error}`);
  return sent.ok;
}
