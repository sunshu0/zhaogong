"use client";

import { useEffect, useState } from "react";
import type { Conversation, Message } from "@/components/seeker/chat-client";
import { countRepliedCandidates, lastActiveLabel } from "@/lib/chat-activity";
import { demoChatActivity, demoEmployerReplyCount } from "@/mock/chat-activity";
import { useLang, useMessages } from "@/i18n/client";
import { chatMessages } from "@/i18n/messages/chat";

function useActivityClock(refresh?: unknown) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 60_000);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, [refresh]);
  return now;
}

export function ChatActivity({
  conversation,
  isEmployer,
  conversations,
  messages,
}: {
  conversation: Conversation;
  isEmployer: boolean;
  conversations: Conversation[];
  messages: Record<string, Message[]>;
}) {
  const t = useMessages(chatMessages).activity;
  const lang = useLang();
  const now = useActivityClock(messages);
  const personId = isEmployer
    ? (conversation.candidateId ??
      (conversation.id.startsWith("recommend:") ? conversation.id.split(":")[1] : conversation.id))
    : conversation.employerId;
  const activity = personId ? demoChatActivity(personId, isEmployer) : undefined;
  const counterpart = t.counterpart(now ? lastActiveLabel(activity?.lastActiveAt, now, lang) : t.loadingLastActive);
  return (
    // E5-1: one line on the business's side, so the messages start higher on a phone; when it does not fit, the other
    // person's last time online gives way (its whole text stays in the title).
    <div
      aria-label={t.chatLabel}
      className={`flex shrink-0 items-center px-4 py-1 text-meta text-muted lg:px-6 ${
        isEmployer ? "gap-x-2" : "flex-wrap gap-x-3 gap-y-0.5"
      }`}
    >
      {isEmployer ? (
        <span className="min-w-0 truncate" title={counterpart}>
          {counterpart}
        </span>
      ) : (
        <span>{counterpart}</span>
      )}
      <span className={isEmployer ? "shrink-0" : undefined}>
        {isEmployer
          ? t.repliedByMe(now ? countRepliedCandidates(conversations, messages, now) : 0)
          : activity && now
            ? t.repliedByEmployer(demoEmployerReplyCount(activity, now))
            : t.noEmployerReplies}
      </span>
      <span className={isEmployer ? "ml-auto shrink-0" : "ml-auto"}>{t.demo}</span>
    </div>
  );
}

export function EmployerActivitySummary({ employerId }: { employerId: string }) {
  const t = useMessages(chatMessages).activity;
  const lang = useLang();
  const now = useActivityClock();
  const activity = demoChatActivity(employerId, false);
  return (
    <div aria-label={t.employerSummaryLabel} className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-body text-muted">
      <span>{now ? lastActiveLabel(activity?.lastActiveAt, now, lang) : t.loadingLastActive}</span>
      <span>{activity && now ? t.repliedToday(demoEmployerReplyCount(activity, now)) : t.noRepliesToday}</span>
      <span className="text-meta">{t.demo}</span>
    </div>
  );
}

export function EmployerJobActivity({ employerId }: { employerId: string }) {
  const t = useMessages(chatMessages).activity;
  const lang = useLang();
  const now = useActivityClock();
  const activity = demoChatActivity(employerId, false);
  return (
    <div aria-label={t.employerJobLabel} className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-meta text-muted">
      <span>{now ? t.lastSeen(lastActiveLabel(activity?.lastActiveAt, now, lang)) : t.loadingLastActive}</span>
      <span>{activity && now ? t.repliedToday(demoEmployerReplyCount(activity, now)) : t.noRepliesToday}</span>
      <span>{t.demo}</span>
    </div>
  );
}
