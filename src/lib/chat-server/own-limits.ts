// Sizes of an identity's own chat record (security review F; messages/actions.ts). It holds only the demo chats of
// demo accounts, chats with demo candidates and records from before #10 (real chats are shared conversations, in
// their own tables), and it is written whole on every change, so it stays small. Over a size a message is not added
// and an import is not taken; the answer says why in the visitor's language.
import { MESSAGE_MAX, type ChatRecord } from "@/components/seeker/chat-store";

/** Conversations in the record: the demo has a handful, and chats with demo candidates one per candidate and job. */
export const OWN_CONVERSATIONS_MAX = 100;
/** Messages added to one conversation: far more than trying out a demo chat; a report takes the last 100. */
export const OWN_MESSAGES_MAX = 200;
/** Reports in an imported record. */
export const OWN_REPORTS_MAX = 100;

/** Whether one more message fits the conversation. */
export function roomForMessage(record: ChatRecord, conversationId: string): boolean {
  return (record.added[conversationId]?.length ?? 0) < OWN_MESSAGES_MAX;
}

/**
 * Whether a record from a browser fits: conversations (opened ones, and any with messages, reads or exchanges),
 * messages per conversation, the length of each message (MESSAGE_MAX, as for one sent) and of report evidence, and
 * reports.
 */
export function fitsOwnLimits(record: ChatRecord): boolean {
  const conversations = new Set([
    ...record.extra.map((c) => c.id),
    ...Object.keys(record.added),
    ...Object.keys(record.readAt),
    ...Object.keys(record.exchanges),
  ]);
  const short = (m: { text: string }) => m.text.length <= MESSAGE_MAX;
  return (
    conversations.size <= OWN_CONVERSATIONS_MAX &&
    Object.values(record.added).every((list) => list.length <= OWN_MESSAGES_MAX && list.every(short)) &&
    record.reports.length <= OWN_REPORTS_MAX &&
    record.reports.every((r) => r.evidence.every(short))
  );
}
