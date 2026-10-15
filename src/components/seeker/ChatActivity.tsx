"use client";

import { useEffect, useState } from "react";
import type { Conversation, Message } from "@/components/seeker/chat-client";
import { countRepliedCandidates, lastActiveLabel } from "@/lib/chat-activity";
import { demoChatActivity, demoEmployerReplyCount } from "@/mock/chat-activity";

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
  const now = useActivityClock(messages);
  const personId = isEmployer
    ? (conversation.candidateId ??
      (conversation.id.startsWith("recommend:") ? conversation.id.split(":")[1] : conversation.id))
    : conversation.employerId;
  const activity = personId ? demoChatActivity(personId, isEmployer) : undefined;
  return (
    <div
      aria-label="沟通状态"
      className="flex shrink-0 items-center gap-x-3 overflow-hidden px-4 py-1 text-meta whitespace-nowrap text-muted lg:px-6"
    >
      <span>对方{now ? lastActiveLabel(activity?.lastActiveAt, now) : "最近上线时间加载中"}</span>
      <span>
        {isEmployer
          ? `你今日已回复 ${now ? countRepliedCandidates(conversations, messages, now) : 0} 位求职者`
          : activity && now
            ? `雇主今日已回复 ${demoEmployerReplyCount(activity, now)} 位求职者`
            : "雇主今日回复人数暂无记录"}
      </span>
      <span className="ml-auto">演示状态</span>
    </div>
  );
}

export function EmployerActivitySummary({ employerId }: { employerId: string }) {
  const now = useActivityClock();
  const activity = demoChatActivity(employerId, false);
  return (
    <div aria-label="雇主沟通情况" className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
      <span>{now ? lastActiveLabel(activity?.lastActiveAt, now) : "最近上线时间加载中"}</span>
      <span>
        {activity && now ? `今日已回复 ${demoEmployerReplyCount(activity, now)} 位求职者` : "今日回复人数暂无记录"}
      </span>
      <span className="text-xs">演示状态</span>
    </div>
  );
}

export function EmployerJobActivity({ employerId }: { employerId: string }) {
  const now = useActivityClock();
  const activity = demoChatActivity(employerId, false);
  return (
    <div aria-label="雇主招聘沟通情况" className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      <span>{now ? `最近在线：${lastActiveLabel(activity?.lastActiveAt, now)}` : "最近上线时间加载中"}</span>
      <span>
        {activity && now ? `今日已回复 ${demoEmployerReplyCount(activity, now)} 位求职者` : "今日回复人数暂无记录"}
      </span>
      <span>演示状态</span>
    </div>
  );
}
