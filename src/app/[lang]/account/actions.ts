"use server";

// 导出我的数据 and 删除账号 (#54, R-30) for the signed-in account. The account always comes from the session cookie;
// the email typed to confirm a deletion must match it.
import { deleteAccount, exportAccountData, type ServerAccountData } from "@/db/account-data";
import { getCurrentSession, signOut } from "@/lib/auth";
import { confirmsEmail } from "@/components/account/my-data";
import { pick } from "@/i18n/messages";
import { accountMessages } from "@/i18n/messages/account";
import { requestLang } from "@/i18n/server";

type Failure = { ok: false; error: string };

/** What the server keeps about the signed-in account. */
export async function myServerData(): Promise<{ ok: true; data: ServerAccountData } | Failure> {
  const t = pick(accountMessages, await requestLang()).errors;
  const session = await getCurrentSession();
  if (!session) return { ok: false, error: t.signInFirst };
  const data = await exportAccountData(session.email);
  if (!data) return { ok: false, error: t.noAccount };
  return { ok: true, data };
}

/** Deletes the signed-in account and ends the session here (deleting the account ends every other session too). */
export async function deleteMyAccount(typedEmail: string): Promise<{ ok: true } | Failure> {
  const t = pick(accountMessages, await requestLang()).errors;
  const session = await getCurrentSession();
  if (!session) return { ok: false, error: t.signInFirst };
  if (typeof typedEmail !== "string" || !confirmsEmail(typedEmail, session.email)) {
    return { ok: false, error: t.emailMismatch };
  }
  const result = await deleteAccount(session.email);
  if (result === "last_moderator") {
    return { ok: false, error: t.lastModerator };
  }
  if (result === "last_team_admin") {
    return { ok: false, error: t.lastAdmin };
  }
  await signOut();
  return { ok: true };
}
