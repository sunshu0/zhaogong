"use server";

// 审核员和雇主聊天 for /admin (#407, ADR 0046): a moderator only (requireModerator, as every /admin Server Function).
// A moderator opens a business's conversation from a report, a verification application or a temporary ban; the
// moderators answer as one (找工审核员), and each message keeps which of them wrote it.
import {
  MODERATOR_CHAT_ORIGINS,
  addModeratorChatMessage,
  getModeratorChat,
  listModeratorChats,
  markModeratorChatRead,
  moderatorChatMessages as readMessages,
  openModeratorChat,
  type ModeratorChatOrigin,
  type ModeratorChatSummary,
} from "@/db/moderator-chats";
import { getEmployer } from "@/lib/data";
import {
  moderatorChatText,
  moderatorChatView,
  MODERATOR_CHAT_TEXT_MAX,
  type ModeratorChatView,
} from "@/lib/moderator-chat";
import { refusedText, requireModerator } from "@/app/[lang]/admin/moderator";
import { moderatorLabel } from "@/app/[lang]/admin/moderation";
import { DELETED_ACCOUNT } from "@/lib/deleted-account";
import type { Refused } from "@/app/[lang]/admin/actions";
import { pick } from "@/i18n/messages";
import { moderatorChatMessages } from "@/i18n/messages/moderator-chat";
import { requestLang } from "@/i18n/server";

export type ModeratorChatAnswer = { ok: true; employerId: string } | { ok: false; error_zh: string };

const idOf = (value: unknown) => (typeof value === "string" ? value : "");

/** The conversations, the newest message first, with what waits unread. */
export async function getModeratorChats(): Promise<{ chats: ModeratorChatSummary[] } | Refused> {
  const me = await requireModerator();
  if (!me.ok) return { refused: me.reason, error_zh: await refusedText(me.reason) };
  return { chats: await listModeratorChats() };
}

/** Opens the business's conversation (or keeps the one it has) from `from`. */
export async function startModeratorChat(employerId: unknown, from: unknown): Promise<ModeratorChatAnswer> {
  const me = await requireModerator();
  if (!me.ok) return { ok: false, error_zh: await refusedText(me.reason) };
  const id = idOf(employerId);
  const origin = MODERATOR_CHAT_ORIGINS.find((o) => o === from) ?? ("report" satisfies ModeratorChatOrigin);
  if (!id || !(await openModeratorChat(id, me.email, origin)))
    return { ok: false, error_zh: pick(moderatorChatMessages, await requestLang()).admin.notFound };
  return { ok: true, employerId: id };
}

/**
 * One conversation as the moderators see it; reading it marks it read for them all. Undefined when there is none.
 * `read: false` reads without marking (the page is in the background).
 */
export async function getModeratorChatThread(
  employerId: unknown,
  read: unknown = true,
): Promise<{ view: ModeratorChatView | undefined } | Refused> {
  const me = await requireModerator();
  if (!me.ok) return { refused: me.reason, error_zh: await refusedText(me.reason) };
  const id = idOf(employerId);
  const chat = id ? await getModeratorChat(id) : undefined;
  if (!chat) return { view: undefined };
  if (read !== false) await markModeratorChatRead(id, "moderator");
  const employer = await getEmployer(id);
  const lang = await requestLang();
  const fresh = (await getModeratorChat(id)) ?? chat;
  const deleted = moderatorLabel(DELETED_ACCOUNT, lang);
  return { view: moderatorChatView("moderator", fresh, employer?.name ?? id, await readMessages(id), deleted) };
}

/** A moderator's message to the business. */
export async function sendModeratorChatMessage(employerId: unknown, text: unknown): Promise<ModeratorChatAnswer> {
  const me = await requireModerator();
  if (!me.ok) return { ok: false, error_zh: await refusedText(me.reason) };
  const t = pick(moderatorChatMessages, await requestLang());
  const id = idOf(employerId);
  const message = moderatorChatText(text);
  if (!message.ok)
    return { ok: false, error_zh: message.reason === "long" ? t.tooLong(MODERATOR_CHAT_TEXT_MAX) : t.emptyText };
  if (!id || !(await getModeratorChat(id))) return { ok: false, error_zh: t.employer.gone };
  const added = await addModeratorChatMessage({
    employerId: id,
    from: "moderator",
    senderEmail: me.email,
    text: message.text,
  });
  return added ? { ok: true, employerId: id } : { ok: false, error_zh: t.full };
}
