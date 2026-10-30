import { connection } from "next/server";
import { SignedOutNote } from "@/components/ui/SignedOutNote";
import { signInNotice } from "@/lib/auth/notice";
import { loginMessages } from "@/i18n/messages/login";
import { messages } from "@/i18n/server";

/**
 * The line at the top of every page while signing in is closed or by invitation only (user feedback 10-30 #1): a
 * visitor knows before pressing 立即沟通, 收藏 or 发布招聘. Asked at request time, in its own Suspense.
 */
export async function SignInNoticeBar() {
  await connection();
  const notice = await signInNotice();
  if (!notice) return null;
  const t = (await messages(loginMessages)).notice;
  return (
    <SignedOutNote
      text={t.site[notice]}
      className="mb-3 rounded-control bg-surface px-3 py-2 text-meta text-muted ring-1 ring-border"
    />
  );
}
