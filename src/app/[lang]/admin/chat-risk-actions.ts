"use server";

// 聊天风险 for /admin (#384, ADR 0039): businesses whose chat messages hit the chat rules again and again. A moderator
// only (requireModerator, as every /admin Server Function). The list says which business, which kinds, how many and
// when; the messages themselves are someone's words, so handing them over is recorded first (ADR 0026: kind chat,
// each conversation's id), as a report's evidence is.
import { addModerationLog, getEmployer } from "@/lib/data";
import { recordViews } from "@/db/personal-info-views";
import {
  chatRiskMessages,
  closeChatRisk,
  listChatRiskItems,
  type ChatRiskItem,
  type ChatRiskMessage,
} from "@/db/chat-risk";
import { describeAction } from "@/app/[lang]/admin/moderation";
import { refusedText, requireModerator } from "@/app/[lang]/admin/moderator";
import type { AdminResult, Refused } from "@/app/[lang]/admin/actions";
import { pick } from "@/i18n/messages";
import { adminViewsMessages } from "@/i18n/messages/admin-views";
import { requestLang } from "@/i18n/server";

/** The open items, the one with the newest message first. */
export async function getChatRiskQueue(): Promise<{ items: ChatRiskItem[] } | Refused> {
  const me = await requireModerator();
  if (!me.ok) return { refused: me.reason, error_zh: await refusedText(me.reason) };
  return { items: await listChatRiskItems() };
}

/** The messages of a business's open item, newest first; recorded as a view of each conversation they are in. */
export async function getChatRiskMessages(employerId: unknown): Promise<{ messages: ChatRiskMessage[] } | Refused> {
  const me = await requireModerator();
  if (!me.ok) return { refused: me.reason, error_zh: await refusedText(me.reason) };
  const id = typeof employerId === "string" ? employerId : "";
  const messages = id ? await chatRiskMessages(id) : [];
  if (messages.length) await recordViews(me.email, "chat", [...new Set(messages.map((m) => m.conversationId))]);
  return { messages };
}

/** A moderator has looked into a business's messages: the item closes, and only new ones open it again. */
export async function closeChatRiskItem(employerId: unknown): Promise<AdminResult> {
  const me = await requireModerator();
  if (!me.ok) return { ok: false, error_zh: await refusedText(me.reason) };
  const lang = await requestLang();
  const id = typeof employerId === "string" ? employerId : "";
  const closed = id ? await closeChatRisk(id) : undefined;
  if (!closed) return { ok: false, error_zh: pick(adminViewsMessages, lang).chatRisk.gone };
  const employer = await getEmployer(id);
  const entry = await addModerationLog({
    action: "chat_risk_close",
    employerId: id,
    employerName: employer?.name ?? id,
    rules: closed.rules,
    moderator: me.email,
  });
  return { ok: true, text: describeAction(entry, lang) };
}
