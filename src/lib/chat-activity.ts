import type { Conversation, Message } from "@/components/seeker/chat-client";

export function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
}

export function messageReadLabel(message: Message): string {
  if (message.readAt) return message.from === "me" ? "已读" : "我已读";
  return message.from === "me" ? (message.sentAt ? "未读" : "阅读状态未知") : "我未读";
}

export function lastActiveLabel(lastActiveAt: string | undefined, now: number): string {
  if (!validTimestamp(lastActiveAt)) return "最近上线时间未知";
  const minutes = Math.max(0, Math.floor((now - Date.parse(lastActiveAt)) / 60_000));
  if (minutes < 1) return "刚刚在线";
  if (minutes < 60) return `约 ${minutes} 分钟前在线`;
  if (minutes < 1440) return `约 ${Math.floor(minutes / 60)} 小时前在线`;
  if (minutes < 10080) return `约 ${Math.floor(minutes / 1440)} 天前在线`;
  return "一周前在线";
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
