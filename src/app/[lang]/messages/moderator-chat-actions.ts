"use server";

// 审核员和雇主聊天, the business's side (#407, ADR 0046): its conversation with the moderators, shown pinned in 消息.
// The business comes from the account, never the browser. Everyone in its team reads and writes it; a banned business
// too (its people are kept out of the employer identity, so they read it as job seekers do). The moderators are
// 找工审核员 here: no email.
import { getCurrentSession } from "@/lib/auth";
import { getAccount, getEmployer } from "@/lib/data";
import { isBanned } from "@/lib/employer-ban";
import {
  addModeratorChatMessage,
  getModeratorChat,
  markModeratorChatRead,
  moderatorChatMessages as readMessages,
} from "@/db/moderator-chats";
import {
  moderatorChatText,
  moderatorChatView,
  MODERATOR_CHAT_TEXT_MAX,
  type ModeratorChatView,
} from "@/lib/moderator-chat";
import { pick } from "@/i18n/messages";
import { moderatorChatMessages } from "@/i18n/messages/moderator-chat";
import { requestLang } from "@/i18n/server";

/**
 * The signed-in account's business and the name its team knows the person by, when the conversation is for this
 * identity: the employer identity, or any while the business is banned (it cannot be the employer identity then).
 */
async function myBusiness(): Promise<{ email: string; employerId: string; name: string | null } | undefined> {
  const session = await getCurrentSession();
  if (!session) return undefined;
  const account = await getAccount(session.email);
  const employerId = account?.employerId;
  if (!employerId) return undefined;
  if (session.activeRole !== "employer" && !isBanned(await getEmployer(employerId), Date.now())) return undefined;
  return { email: session.email, employerId, name: account.teamName ?? null };
}

/** The business's conversation with the moderators, or null when it has none (or this identity is not the business's). */
export async function myModeratorChat(): Promise<ModeratorChatView | null> {
  const me = await myBusiness();
  const chat = me && (await getModeratorChat(me.employerId));
  if (!me || !chat) return null;
  const employer = await getEmployer(me.employerId);
  return moderatorChatView("employer", chat, employer?.name ?? me.employerId, await readMessages(me.employerId));
}

/** The team has read the conversation up to now. */
export async function readMyModeratorChat(): Promise<void> {
  const me = await myBusiness();
  if (me && (await getModeratorChat(me.employerId))) await markModeratorChatRead(me.employerId, "employer");
}

/** A message from the business's team to the moderators: the conversation as it is now, or why it was not sent. */
export async function sendToModerators(
  text: unknown,
): Promise<{ ok: true; view: ModeratorChatView } | { ok: false; error: string }> {
  const t = pick(moderatorChatMessages, await requestLang());
  const message = moderatorChatText(text);
  if (!message.ok)
    return { ok: false, error: message.reason === "long" ? t.tooLong(MODERATOR_CHAT_TEXT_MAX) : t.emptyText };
  const me = await myBusiness();
  if (!me || !(await getModeratorChat(me.employerId))) return { ok: false, error: t.employer.gone };
  const added = await addModeratorChatMessage({
    employerId: me.employerId,
    from: "employer",
    senderEmail: me.email,
    byName: me.name,
    text: message.text,
  });
  const view = await myModeratorChat();
  if (!added || !view) return { ok: false, error: added ? t.employer.gone : t.full };
  return { ok: true, view };
}
