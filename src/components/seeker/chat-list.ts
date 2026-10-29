// C7 (ADR 0053): the chat list's groups — 新招呼, 沟通中, 已约面 — and its order, pinned conversations first. Pure:
// the list (MessageWorkspace.tsx) gives it what useChat has. The same for both sides, each from its own side: on a
// business's side "I" is the whole team, as the read state is.
import type { Exchange } from "@/lib/chat-consent";
import type { ChatView, Conversation, Message } from "@/components/seeker/chat-store";

export type ChatGroup = "new" | "talking" | "interview";
export const CHAT_GROUPS: readonly ChatGroup[] = ["new", "talking", "interview"];
export type ChatFilter = ChatGroup | "all";

/**
 * Where a conversation goes. 已约面: an interview invitation still in play (the server marks it). 新招呼: the other
 * side said something (a message, or asked for an exchange) and this side has not answered at all yet. 沟通中: the
 * rest — both have spoken, or this side spoke first and waits.
 */
export function chatGroup(
  conversation: Conversation,
  messages: readonly Message[],
  exchanges: readonly Exchange[],
): ChatGroup {
  if (conversation.interview) return "interview";
  const theySpoke = messages.some((m) => m.from === "them") || exchanges.some((x) => x.from === "them");
  const answered =
    messages.some((m) => m.from === "me") ||
    exchanges.some((x) => x.from === "me" || x.status === "accepted" || x.status === "rejected");
  return theySpoke && !answered ? "new" : "talking";
}

/**
 * The list as shown: the conversations in the filter, pinned ones first (the latest pinned at the top), then the
 * others in the order they came (newest first); and how many each filter has.
 */
export function chatList(
  view: Pick<ChatView, "conversations" | "messages" | "exchanges" | "pinned">,
  filter: ChatFilter,
): { rows: Conversation[]; counts: Record<ChatFilter, number> } {
  const counts: Record<ChatFilter, number> = { all: view.conversations.length, new: 0, talking: 0, interview: 0 };
  const shown: Conversation[] = [];
  for (const conversation of view.conversations) {
    const group = chatGroup(conversation, view.messages[conversation.id] ?? [], view.exchanges[conversation.id] ?? []);
    counts[group] += 1;
    if (filter === "all" || filter === group) shown.push(conversation);
  }
  const pinnedAt = (c: Conversation) => view.pinned[c.id];
  const pinned = shown.filter(pinnedAt).sort((a, b) => pinnedAt(b).localeCompare(pinnedAt(a)));
  return { rows: [...pinned, ...shown.filter((c) => !pinnedAt(c))], counts };
}
