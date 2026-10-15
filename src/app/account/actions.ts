"use server";

// 导出我的数据 and 删除账号 (#54, R-30) for the signed-in account. The account always comes from the session cookie;
// the email typed to confirm a deletion must match it.
import { deleteAccount, exportAccountData, type ServerAccountData } from "@/db/account-data";
import { getCurrentSession, signOut } from "@/lib/auth";
import { confirmsEmail } from "@/components/account/my-data";

type Failure = { ok: false; error: string };

/** What the server keeps about the signed-in account. */
export async function myServerData(): Promise<{ ok: true; data: ServerAccountData } | Failure> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, error: "请先登录" };
  const data = await exportAccountData(session.email);
  if (!data) return { ok: false, error: "找不到这个账号" };
  return { ok: true, data };
}

/** Deletes the signed-in account and ends the session here (deleting the account ends every other session too). */
export async function deleteMyAccount(typedEmail: string): Promise<{ ok: true } | Failure> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, error: "请先登录" };
  if (typeof typedEmail !== "string" || !confirmsEmail(typedEmail, session.email)) {
    return { ok: false, error: "输入的邮箱和当前登录的邮箱不一致" };
  }
  const result = await deleteAccount(session.email);
  if (result === "last_moderator") {
    return { ok: false, error: "你是最后一位审核员。请先在审核后台添加另一位审核员，再删除账号。" };
  }
  await signOut();
  return { ok: true };
}
