// Where sign-in codes go. There is no mail service yet (that needs the user's account with a provider):
// in development and the browser tests' build (#139) the code is printed to the server log and shown on the sign-in
// page; in production, sign-in refuses until a mailer is added here.
import { devHelpersEnabled } from "@/lib/test-build";

/** Whether codes can be delivered at all in this environment. */
export function canSendCodes(): boolean {
  return devHelpersEnabled();
}

/** Sends a sign-in code. Callers check canSendCodes() first. */
export async function sendSignInCode(email: string, code: string): Promise<void> {
  if (!devHelpersEnabled()) {
    throw new Error("No mail service is configured; sign-in codes cannot be sent in production.");
  }
  console.info(`[auth] 开发模式验证码 ${email}: ${code}`);
}
