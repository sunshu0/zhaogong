"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { conversationProfileHref, useChat, type Conversation } from "@/components/seeker/chat-client";
import { ChatActivity } from "@/components/seeker/ChatActivity";
import { ChatExchangeTools, ChatReportButton } from "@/components/seeker/ChatInteractions";
import { MessageLog } from "@/components/seeker/MessageLog";
import { CounterpartAvatar } from "@/components/seeker/ProfileAvatar";

export function ChatThread({
  conversation,
  isEmployer,
  draft,
  onDraftChange,
  onBack,
}: {
  conversation: Conversation;
  isEmployer: boolean;
  draft: string;
  onDraftChange: (draft: string) => void;
  onBack: () => void;
}) {
  const { messages, conversations, send } = useChat();

  function submit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    send(conversation.id, text);
    onDraftChange("");
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-col" aria-label={`与${conversation.person}的聊天`}>
      <ThreadHeader conversation={conversation} isEmployer={isEmployer} onBack={onBack} />

      <ChatActivity
        conversation={conversation}
        isEmployer={isEmployer}
        conversations={conversations}
        messages={messages}
      />

      <MessageLog conversationId={conversation.id} thread={messages[conversation.id]} />

      <div className="shrink-0 border-t border-border px-4 py-3 lg:px-6 lg:py-4">
        <ChatExchangeTools key={conversation.id} conversationId={conversation.id} />
        <MessageComposer draft={draft} onDraftChange={onDraftChange} onSubmit={submit} />
      </div>
    </section>
  );
}

function ThreadHeader({
  conversation,
  isEmployer,
  onBack,
}: {
  conversation: Conversation;
  isEmployer: boolean;
  onBack: () => void;
}) {
  const showEmployerLink = !isEmployer && typeof conversation.employerId === "string";
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3">
      <button
        type="button"
        onClick={onBack}
        aria-label="返回会话列表"
        title="返回会话列表"
        className="flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-background lg:hidden"
      >
        <ArrowLeft aria-hidden="true" className="size-5" />
      </button>
      <Counterpart conversation={conversation} isEmployer={isEmployer} />
      <div className="ml-auto flex shrink-0 flex-col gap-1 text-right sm:flex-row sm:gap-3">
        {showEmployerLink && (
          <Link
            href={`/employers/${conversation.employerId}`}
            className="text-sm text-brand underline underline-offset-2"
          >
            雇主主页
          </Link>
        )}
        {conversation.job && (
          <Link href={`/jobs/${conversation.job}`} className="text-sm text-brand underline underline-offset-2">
            查看职位
          </Link>
        )}
      </div>
      <ChatReportButton key={conversation.id} conversation={conversation} />
    </div>
  );
}

/** Avatar, name and job of the other person; a link to their public page when they have one. */
function Counterpart({ conversation, isEmployer }: { conversation: Conversation; isEmployer: boolean }) {
  const profileHref = conversationProfileHref(conversation, isEmployer);
  const job = (
    <p className="truncate text-xs text-muted">
      {isEmployer ? "应聘" : "招聘"}：{conversation.title}
    </p>
  );
  if (!profileHref) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <CounterpartAvatar conversation={conversation} isEmployer={isEmployer} />
        <div className="min-w-0">
          <h2 className="truncate font-medium">{conversation.person}</h2>
          {job}
        </div>
      </div>
    );
  }
  return (
    <Link
      href={profileHref}
      aria-label={`查看${conversation.person}的主页`}
      title={`查看${conversation.person}的主页`}
      className="group flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-brand"
    >
      <CounterpartAvatar conversation={conversation} isEmployer={isEmployer} />
      <div className="min-w-0">
        <h2 className="break-words font-medium leading-snug group-hover:text-brand group-hover:underline sm:truncate">
          {conversation.person}
        </h2>
        {job}
      </div>
    </Link>
  );
}

function MessageComposer({
  draft,
  onDraftChange,
  onSubmit,
}: {
  draft: string;
  onDraftChange: (draft: string) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="flex items-end gap-2">
      <label className="sr-only" htmlFor="message-draft">
        输入消息
      </label>
      <textarea
        id="message-draft"
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        placeholder="输入消息…"
        rows={3}
        className="min-h-11 min-w-0 flex-1 resize-none rounded-lg border border-border bg-surface px-3 py-2 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
      <button
        type="submit"
        disabled={!draft.trim()}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        <Send aria-hidden="true" className="size-4" />
        发送
      </button>
    </form>
  );
}
