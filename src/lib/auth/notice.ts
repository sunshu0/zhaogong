// Whether signing in is open on this server, for saying so before anyone presses 立即沟通, 收藏 or 发布招聘
// (user feedback 10-30 #1): "closed" with no mail service (the demo site before SES, #332), "invited" while
// SIGN_IN_ALLOWLIST is set (allowlist.ts); undefined when anyone may. Read at request time. Server only.
import { cookies } from "next/headers";
import { signInAllowlist } from "@/lib/auth/allowlist";
import { canSendCodes } from "@/lib/auth/delivery";
import { isTestBuild } from "@/lib/test-build";

export type SignInNotice = "closed" | "invited";

/** The browser tests' build always sends codes; this cookie shows them either notice (e2e/sign-in-notice.spec.ts). */
export const TEST_NOTICE_COOKIE = "zg_e2e_sign_in_notice";

export function signInNoticeFor(env: Record<string, string | undefined> = process.env): SignInNotice | undefined {
  if (!canSendCodes()) return "closed";
  if (signInAllowlist(env)) return "invited";
  return undefined;
}

export async function signInNotice(): Promise<SignInNotice | undefined> {
  if (isTestBuild()) {
    const asked = (await cookies()).get(TEST_NOTICE_COOKIE)?.value;
    if (asked === "closed" || asked === "invited") return asked;
  }
  return signInNoticeFor();
}
