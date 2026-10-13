"use client";

import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { useChat } from "@/components/seeker/chat-client";

export function UnreadBadge({ count }: { count: number }) {
  if (!count) return null;
  return <span aria-hidden="true" className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-semibold text-white">{count > 99 ? "99+" : count}</span>;
}

export function ChatEntry() {
  const { totalUnread } = useChat();
  return (
    <Link href="/messages" title={totalUnread ? `聊天，${totalUnread} 条未读消息` : "聊天"} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap px-1 font-semibold text-brand sm:gap-2">
      <MessageSquare aria-hidden="true" className="hidden size-5 sm:block" />
      聊天 <UnreadBadge count={totalUnread} />
    </Link>
  );
}
