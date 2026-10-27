// 审核员和雇主聊天 (#407, ADR 0046): what each side is shown of a business's conversation with the moderators. The
// business never sees which moderator wrote (找工审核员); the moderators see each other's emails and the team's names.
import { DELETED_ACCOUNT } from "@/lib/deleted-account";

/** As long as a chat message can be (chat-store's MESSAGE_MAX). */
export const MODERATOR_CHAT_TEXT_MAX = 2000;

export type ModeratorChatSide = "moderator" | "employer";

/** One message as a side is shown it. */
export interface ModeratorChatLine {
  id: number;
  /** Sent by this side: the moderators, or the business's team. */
  mine: boolean;
  text: string;
  sentAt: string;
  /** Who sent it, for whoever may know: a team member's name; for the moderators, which moderator. */
  by?: string;
  /** For this side's own messages: whether the other side has read it. */
  read?: boolean;
}

export interface ModeratorChatView {
  employerId: string;
  employerName: string;
  lines: ModeratorChatLine[];
  /** The other side's messages this side has not read. */
  unread: number;
}

type Row = {
  id: number;
  from: ModeratorChatSide;
  senderEmail: string;
  byName: string | null;
  text: string;
  sentAt: string;
};
type Chat = { employerId: string; employerReadAt: string | null; moderatorsReadAt: string | null };

/**
 * The conversation for one side. `deleted`: how the moderators' side names a moderator whose account is gone.
 */
export function moderatorChatView(
  side: ModeratorChatSide,
  chat: Chat,
  employerName: string,
  rows: Row[],
  deleted = DELETED_ACCOUNT,
): ModeratorChatView {
  const ownRead = (side === "moderator" ? chat.moderatorsReadAt : chat.employerReadAt) ?? "";
  const otherRead = (side === "moderator" ? chat.employerReadAt : chat.moderatorsReadAt) ?? "";
  const lines = rows.map((row): ModeratorChatLine => {
    const mine = row.from === side;
    const by =
      row.from === "employer"
        ? (row.byName ?? undefined)
        : side === "moderator"
          ? row.senderEmail === DELETED_ACCOUNT
            ? deleted
            : row.senderEmail
          : undefined;
    return {
      id: row.id,
      mine,
      text: row.text,
      sentAt: row.sentAt,
      ...(by ? { by } : {}),
      ...(mine ? { read: otherRead >= row.sentAt } : {}),
    };
  });
  return {
    employerId: chat.employerId,
    employerName,
    lines,
    unread: rows.filter((row) => row.from !== side && row.sentAt > ownRead).length,
  };
}

/** The message to send, trimmed; why not when it cannot go. */
export function moderatorChatText(text: unknown): { ok: true; text: string } | { ok: false; reason: "empty" | "long" } {
  const trimmed = typeof text === "string" ? text.trim() : "";
  if (!trimmed) return { ok: false, reason: "empty" };
  if (trimmed.length > MODERATOR_CHAT_TEXT_MAX) return { ok: false, reason: "long" };
  return { ok: true, text: trimmed };
}
