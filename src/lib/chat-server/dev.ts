// The other side of a demo conversation, for development and the browser tests only: the demo counterparts are
// not real accounts, so their replies and read receipts are written here (POST /api/dev/chat-reply). Never in
// production; on in the browser tests' build (#139). Server only.
import type { ChatRecord, Message } from "@/components/seeker/chat-store";
import { devHelpersEnabled } from "@/lib/test-build";

export function devRepliesEnabled(): boolean {
  return devHelpersEnabled();
}

/** The counterpart reads what the user sent in that conversation so far, then optionally replies. */
export function counterpartActs(
  record: ChatRecord,
  conversationId: string,
  act: { readMine?: boolean; reply?: string },
  now: string,
): ChatRecord {
  const thread = record.added[conversationId] ?? [];
  const read = act.readMine
    ? thread.map((m): Message => (m.from === "me" && !m.readAt ? { ...m, readAt: now } : m))
    : thread;
  const reply = act.reply?.trim();
  const next = reply ? [...read, { from: "them" as const, text: reply, time: "刚刚", sentAt: now }] : read;
  return { ...record, added: { ...record.added, [conversationId]: next } };
}
