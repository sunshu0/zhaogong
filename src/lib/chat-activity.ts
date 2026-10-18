import type { Conversation, Message } from "@/components/seeker/chat-client";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { chatMessages } from "@/i18n/messages/chat";

export function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
}

export function messageReadLabel(message: Message, lang: Lang = DEFAULT_LANG): string {
  const t = pick(chatMessages, lang).activity;
  if (message.readAt) return message.from === "me" ? t.read : t.readByMe;
  return message.from === "me" ? (message.sentAt ? t.unread : t.readUnknown) : t.unreadByMe;
}

export function lastActiveLabel(lastActiveAt: string | undefined, now: number, lang: Lang = DEFAULT_LANG): string {
  const t = pick(chatMessages, lang).activity;
  if (!validTimestamp(lastActiveAt)) return t.lastActiveUnknown;
  const minutes = Math.max(0, Math.floor((now - Date.parse(lastActiveAt)) / 60_000));
  if (minutes < 1) return t.onlineJustNow;
  if (minutes < 60) return t.onlineMinutes(minutes);
  if (minutes < 1440) return t.onlineHours(Math.floor(minutes / 60));
  if (minutes < 10080) return t.onlineDays(Math.floor(minutes / 1440));
  return t.onlineOverAWeek;
}

export function aucklandDay(timestamp: number): string {
  return new Intl.DateTimeFormat("en-NZ", {
    timeZone: "Pacific/Auckland",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(timestamp);
}

export function countRepliedCandidates(
  conversations: Conversation[],
  messages: Record<string, Message[]>,
  now: number,
): number {
  const people = new Set<string>();
  const today = aucklandDay(now);
  for (const conversation of conversations) {
    let received = false;
    for (const message of messages[conversation.id] ?? []) {
      if (message.from === "them") received = true;
      else if (
        received &&
        validTimestamp(message.sentAt) &&
        Date.parse(message.sentAt) <= now &&
        aucklandDay(Date.parse(message.sentAt)) === today
      ) {
        const person =
          conversation.candidateId ??
          (conversation.id.startsWith("recommend:") ? conversation.id.split(":")[1] : conversation.id);
        if (person) people.add(person);
      }
    }
  }
  return people.size;
}
