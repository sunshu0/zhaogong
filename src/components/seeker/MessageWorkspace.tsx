"use client";

import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { useChat, useChatRefresh, type Conversation, type Message } from "@/components/seeker/chat-client";
import { UnreadBadge } from "@/components/seeker/ChatEntry";
import { ChatThread } from "@/components/seeker/ChatThread";
import { CounterpartAvatar } from "@/components/seeker/ProfileAvatar";
import { useSession } from "@/components/seeker/session-client";
import { isDemoAccount } from "@/lib/demo-accounts";

export function MessageWorkspace({ initialId }: { initialId: string | null }) {
  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const { messages, unread, totalUnread, conversations, markRead } = useChat();
  const session = useSession();
  const isEmployer = session?.activeRole === "employer";
  const demoAccount = isDemoAccount(session?.email);
  const [draft, setDraft] = useState("");
  const selected = conversations.find((item) => item.id === selectedId);
  useChatRefresh();
  useMarkReadWhileVisible(selectedId, selected ? messages[selected.id] : undefined, markRead);

  function select(id: string) {
    setSelectedId(id);
    markRead(id);
    setDraft("");
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{isEmployer ? "招聘聊天" : "求职聊天"}</h1>
        <p role="status" className="text-sm text-muted">
          {totalUnread ? `${totalUnread} 条未读消息` : "消息已全部读完"}
          {demoAccount && <span className="ml-2 text-xs">演示数据</span>}
        </p>
      </header>

      <div
        data-chat-workspace=""
        className="grid h-[calc(100dvh_-_13rem_-_var(--bottom-nav-space))] min-h-[24rem] overflow-hidden rounded-md border border-border bg-surface lg:h-[calc(100dvh_-_9rem)] lg:min-h-[30rem] lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)]"
      >
        <ConversationList
          conversations={conversations}
          messages={messages}
          unread={unread}
          selectedId={selected?.id}
          isEmployer={isEmployer}
          onSelect={select}
        />
        {selected ? (
          <ChatThread
            conversation={selected}
            isEmployer={isEmployer}
            draft={draft}
            onDraftChange={setDraft}
            onBack={() => setSelectedId(null)}
          />
        ) : (
          <NoConversationSelected totalUnread={totalUnread} />
        )}
      </div>
      <p className="text-xs text-muted">
        {demoAccount
          ? "演示账号：这里的联系人和他们的回复都是演示内容。"
          : "消息保存在服务器上，双方都能看到；对方的新消息在这个页面上 10 秒内出现。"}
      </p>
    </div>
  );
}

/** Marks the open conversation read now and whenever the tab becomes visible again. */
function useMarkReadWhileVisible(
  conversationId: string | null,
  thread: Message[] | undefined,
  markRead: (id: string) => void,
) {
  useEffect(() => {
    const readVisible = () => {
      if (conversationId && document.visibilityState === "visible") markRead(conversationId);
    };
    readVisible();
    document.addEventListener("visibilitychange", readVisible);
    return () => document.removeEventListener("visibilitychange", readVisible);
  }, [conversationId, thread, markRead]);
}

function ConversationList({
  conversations,
  messages,
  unread,
  selectedId,
  isEmployer,
  onSelect,
}: Pick<ReturnType<typeof useChat>, "conversations" | "messages" | "unread"> & {
  selectedId: string | undefined;
  isEmployer: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <aside
      className={`${selectedId ? "hidden lg:block" : ""} min-h-0 overflow-y-auto lg:border-r lg:border-border`}
      aria-label="聊天列表"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-medium">最近联系</h2>
        <span className="text-xs text-muted">{conversations.length} 个会话</span>
      </div>
      {conversations.length === 0 && (
        <p className="px-4 py-6 text-sm text-muted">
          还没有聊天。
          {isEmployer
            ? "在申请人列表或推荐人才里点「发起聊天」，就会出现在这里。"
            : "在职位详情里点「立即沟通」，就会出现在这里。"}
        </p>
      )}
      <ul className="divide-y divide-border">
        {conversations.map((conversation) => (
          <li key={conversation.id}>
            <ConversationRow
              conversation={conversation}
              isEmployer={isEmployer}
              selected={selectedId === conversation.id}
              preview={messages[conversation.id].at(-1)?.text ?? "尚未发送消息"}
              unreadCount={unread[conversation.id]}
              onSelect={() => onSelect(conversation.id)}
            />
          </li>
        ))}
      </ul>
    </aside>
  );
}

function ConversationRow({
  conversation,
  isEmployer,
  selected,
  preview,
  unreadCount,
  onSelect,
}: {
  conversation: Conversation;
  isEmployer: boolean;
  selected: boolean;
  preview: string;
  unreadCount: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex w-full gap-3 px-4 py-4 text-left hover:bg-background ${selected ? "bg-brand-soft" : ""}`}
    >
      <CounterpartAvatar conversation={conversation} isEmployer={isEmployer} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{conversation.person}</span>
          <span className="shrink-0 text-[11px] text-muted">{conversation.time}</span>
        </span>
        <span className="mt-1 block truncate text-sm text-muted">{preview}</span>
      </span>
      <UnreadBadge count={unreadCount} />
    </button>
  );
}

function NoConversationSelected({ totalUnread }: { totalUnread: number }) {
  return (
    <section
      className="hidden min-h-64 flex-col items-center justify-center gap-3 bg-background/50 px-4 text-center lg:flex"
      aria-label="选择会话"
    >
      <MessageSquare aria-hidden="true" className="size-12 text-brand" />
      <h2 className="text-lg font-medium">选择一位联系人</h2>
      <p className="text-sm text-muted">{totalUnread ? `你有 ${totalUnread} 条未读消息` : "暂无未读消息"}</p>
    </section>
  );
}
