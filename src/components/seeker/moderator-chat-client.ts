"use client";

// 审核员和雇主聊天, the business's side in the browser (#407, ADR 0046). Unlike the job seekers' chats there is no copy
// kept in the browser and no outbox: the server's answer is all there is. It is read once per page for the unread
// count (the menus and 消息 add it to the chats'), again every CHAT_REFRESH_MS while the chat page is in front, and
// after each message sent.
import { useEffect, useSyncExternalStore } from "react";
import { myModeratorChat, readMyModeratorChat, sendToModerators } from "@/app/[lang]/messages/moderator-chat-actions";
import { identityScope } from "@/components/seeker/identity-scope";
import { useSession } from "@/components/seeker/session-client";
import type { ModeratorChatView } from "@/lib/moderator-chat";

/** The id the open conversation has in the address (?conversation=) and the list. */
export const MODERATOR_CHAT_ID = "moderators";

/** A message sent, or not: why, from the server, or no `error` when it was out of reach. */
export type SendOutcome = { sent: true } | { sent: false; error?: string };

/** What is known for one identity: its conversation, or null when it has none. */
let known: { scope: string; view: ModeratorChatView | null } | undefined;
const listeners = new Set<() => void>();
let loading: Promise<void> | undefined;

function set(scope: string, view: ModeratorChatView | null) {
  known = { scope, view };
  for (const listener of listeners) listener();
}

/** Reads the conversation for this identity; a failed read keeps what was there. */
export function refreshModeratorChat(scope: string): Promise<void> {
  loading ??= myModeratorChat()
    .then((view) => set(scope, view))
    .catch(() => {})
    .finally(() => (loading = undefined));
  return loading;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The identity's conversation with the moderators (null while unknown, or when it has none). */
export function useModeratorChat(): {
  view: ModeratorChatView | null;
  unread: number;
  send: (text: string) => Promise<SendOutcome>;
  markRead: () => void;
} {
  const session = useSession();
  const scope = identityScope(session);
  const signedIn = Boolean(session);
  const current = useSyncExternalStore(
    subscribe,
    () => known,
    () => undefined,
  );
  const view = signedIn && current?.scope === scope ? current.view : null;
  useEffect(() => {
    if (signedIn && known?.scope !== scope) void refreshModeratorChat(scope);
  }, [signedIn, scope]);
  return {
    view,
    unread: view?.unread ?? 0,
    async send(text: string): Promise<SendOutcome> {
      const answer = await sendToModerators(text).catch(() => undefined);
      if (!answer) return { sent: false };
      if (!answer.ok) return { sent: false, error: answer.error };
      set(scope, answer.view);
      return { sent: true };
    },
    markRead() {
      if (!view?.unread) return;
      set(scope, { ...view, unread: 0 });
      void readMyModeratorChat().catch(() => {});
    },
  };
}
