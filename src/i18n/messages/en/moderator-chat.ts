// The English side of moderator-chat.ts (#407): the browser loads it on English pages only (src/i18n/english.ts).
// Typed by the Chinese side: a missing key, an extra key or a different parameter fails tsc.

import type { Messages } from "@/i18n/messages";
import type { moderatorChatMessages } from "@/i18n/messages/moderator-chat";

export const moderatorChatEn: Messages<(typeof moderatorChatMessages)["zh"]> = {
  name: "Zhaogong moderators",
  logLabel: "Messages",
  empty: "No messages yet.",
  emptyText: "Write a message first.",
  read: "Read",
  notRead: "Unread",
  tooLong: (max: number) => `A message can be at most ${max} characters.`,
  full: "This conversation has reached its message limit. Please write to us instead.",
  sendFailed: "It was not sent; the connection may be down. The message is still in the box; please try again.",
  employer: {
    rowNote: "Official",
    label: "Conversation with Zhaogong moderators",
    note: "Zhaogong moderators ask here for verification documents and explain their decisions. Everyone in your team can read and reply.",
    gone: "This conversation is no longer here.",
    back: "Back to the chat list",
  },
  admin: {
    group: "Chats",
    listLabel: "Conversations with businesses",
    listName: "Conversations",
    none: "No conversations yet. Open one with “Chat with business” on a reported job, a verification application or a temporarily banned business.",
    pick: "Pick a conversation.",
    start: "Chat with business",
    starting: "Opening…",
    notFound: "This business could not be found.",
    threadName: (employer: string) => `Conversation with “${employer}”`,
    note: "The business sees “Zhaogong moderators”, not your email; each message records which moderator sent it. Everyone in the business's team can read and reply, a banned business too.",
    teamSigned: (employer: string, name: string) => `${employer} · ${name}`,
    back: "Back to the chat list",
    unread: (n: number) => `${n} unread`,
    you: "You",
    noMessages: "No messages yet",
  },
};
