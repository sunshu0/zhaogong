"use client";
// 审核员和雇主聊天 in /admin (#407, ADR 0046): the 聊天 group — the conversations with businesses, the newest message
// first, and the open one beside them (on a phone it fills the screen, as 消息 does, ADR 0042). A moderator opens one
// with 和企业聊天 on a reported job, a verification application or a temporary ban. The list and the conversation
// are in ModeratorChatBoard, loaded only when the group opens.
import { useCallback, useEffect, useState, useTransition } from "react";
import { getModeratorChats, startModeratorChat } from "@/app/[lang]/admin/chat-actions";
import type { AdminResult, Refused } from "@/app/[lang]/admin/actions";
import type { ModeratorChatOrigin, ModeratorChatSummary } from "@/db/moderator-chats";
import { FAILED, isFailed, ready, settle, type Failed } from "@/app/[lang]/admin/load-state";
import { CHAT_REFRESH_MS } from "@/components/seeker/chat-refresh";
import { conversationAddress } from "@/components/seeker/fullscreen-chat";
import { Button } from "@/components/ui/Button";
import { useMessages } from "@/i18n/client";
import { adminMessages } from "@/i18n/messages/admin";
import { moderatorChatMessages } from "@/i18n/messages/moderator-chat";

export type ChatList = { chats: ModeratorChatSummary[] } | Refused;

/** Calls `tick` every CHAT_REFRESH_MS while the page is in front and `on`, and when it comes back to it. */
export function useWhileVisible(on: boolean, tick: () => void) {
  useEffect(() => {
    if (!on) return;
    const again = () => {
      if (document.visibilityState === "visible") tick();
    };
    const timer = window.setInterval(again, CHAT_REFRESH_MS);
    document.addEventListener("visibilitychange", again);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", again);
    };
  }, [on, tick]);
}

/**
 * The conversations, read with the page's `version`, again every CHAT_REFRESH_MS while `live`, and on `refresh`. The
 * last answer stays while the next is on its way; FAILED only when the first got none.
 */
export function useModeratorChatList(
  version: number,
  live: boolean,
): { list: ChatList | Failed | undefined; refresh: () => void } {
  const [reads, setReads] = useState(0);
  const refresh = useCallback(() => setReads((n) => n + 1), []);
  const [list, setList] = useState<ChatList | Failed>();
  useWhileVisible(live, refresh);
  useEffect(() => {
    let current = true;
    void settle(getModeratorChats).then((answer) => {
      if (current) setList((before) => answer ?? (before && !isFailed(before) ? before : FAILED));
    });
    return () => {
      current = false;
    };
  }, [version, reads]);
  return { list, refresh };
}

/** How many of the businesses' messages wait unread, once the list has answered. */
export function unreadChats(list: ChatList | Failed | undefined): number | undefined {
  return ready(list)?.chats.reduce((n, chat) => n + chat.unread, 0);
}

/** The address that opens a business's conversation in the 聊天 group. */
export function openChatAddress(employerId: string): string {
  return conversationAddress(window.location, employerId);
}

/** 和企业聊天: opens the business's conversation (or the one it has) and shows it. */
export function StartChatButton({
  employerId,
  from,
  onOpen,
  onDone,
}: {
  employerId: string;
  from: ModeratorChatOrigin;
  onOpen: (employerId: string) => void;
  onDone: (result: AdminResult) => void;
}) {
  const t = useMessages(moderatorChatMessages).admin;
  const { tryAgain } = useMessages(adminMessages);
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      loading={pending}
      onClick={() =>
        start(async () => {
          const answer = await settle(() => startModeratorChat(employerId, from));
          if (answer?.ok) onOpen(answer.employerId);
          else onDone({ ok: false, error_zh: answer?.error_zh ?? tryAgain });
        })
      }
    >
      {pending ? t.starting : t.start}
    </Button>
  );
}
