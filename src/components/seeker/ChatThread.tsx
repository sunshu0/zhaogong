"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { conversationProfileHref, useChat, type Conversation } from "@/components/seeker/chat-client";
import { ChatActivity } from "@/components/seeker/ChatActivity";
import { ChatExchangeMenu } from "@/components/seeker/ChatInteractions";
import { ChatReportDialog } from "@/components/seeker/ChatReportButton";
import { ConversationJob } from "@/components/seeker/ConversationJob";
import { MoreMenu, type MoreMenuItem } from "@/components/ui/MoreMenu";
import { MessageLog } from "@/components/seeker/MessageLog";
import { CounterpartAvatar } from "@/components/seeker/ProfileAvatar";
import { outgoingWarning } from "@/components/seeker/chat-warnings";

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
      {conversation.job && <ConversationJob jobId={conversation.job} fallbackTitle={conversation.title} />}

      <ChatActivity
        conversation={conversation}
        isEmployer={isEmployer}
        conversations={conversations}
        messages={messages}
      />

      <MessageLog conversationId={conversation.id} thread={messages[conversation.id]} />

      <div className="shrink-0 border-t border-border px-4 py-3 lg:px-6 lg:py-4">
        <MessageComposer
          draft={draft}
          onDraftChange={onDraftChange}
          onSubmit={submit}
          tools={<ChatExchangeMenu key={conversation.id} conversationId={conversation.id} />}
        />
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
  const [reporting, setReporting] = useState(false);
  const profileHref = conversationProfileHref(conversation, isEmployer);
  // 更多: their page, the job, 举报 — so the header keeps only back, who, and this one button.
  const more: MoreMenuItem[] = [
    ...(profileHref ? [{ label: isEmployer ? "求职者主页" : "雇主主页", href: profileHref }] : []),
    ...(conversation.job ? [{ label: "查看职位", href: `/jobs/${conversation.job}` }] : []),
    { label: "举报", danger: true, onSelect: () => setReporting(true) },
  ];
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
      <MoreMenu items={more} label={`更多：${conversation.person}`} />
      {reporting && (
        <ChatReportDialog key={conversation.id} conversation={conversation} onClose={() => setReporting(false)} />
      )}
    </div>
  );
}

/** Avatar, name and job of the other person; a link to their public page when they have one. */
function Counterpart({ conversation, isEmployer }: { conversation: Conversation; isEmployer: boolean }) {
  const profileHref = conversationProfileHref(conversation, isEmployer);
  // Only when there is no job strip under the header (it names the job already).
  const job = conversation.job ? null : (
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
  tools,
}: {
  draft: string;
  onDraftChange: (draft: string) => void;
  onSubmit: (event: FormEvent) => void;
  /** The ＋ menu (exchanges) beside the input. */
  tools?: ReactNode;
}) {
  // A reminder while writing; the message can still be sent.
  const warning = outgoingWarning(draft);
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
      {tools}
      <label className="sr-only" htmlFor="message-draft">
        输入消息
      </label>
      <textarea
        id="message-draft"
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        placeholder="输入消息…"
        rows={3}
        aria-describedby={warning ? "message-draft-warning" : undefined}
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
      {warning && (
        <p id="message-draft-warning" role="status" className="basis-full text-xs leading-relaxed text-warn">
          {warning}
        </p>
      )}
    </form>
  );
}
