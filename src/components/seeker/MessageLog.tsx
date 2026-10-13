"use client";

import { useEffect, useRef } from "react";
import { useChat, type Message } from "@/components/seeker/chat-client";
import { ChatExchangeList } from "@/components/seeker/ChatInteractions";
import { messageReadLabel } from "@/lib/chat-activity";

/** The messages of one conversation, then its exchange requests; keeps the newest in view. */
export function MessageLog({ conversationId, thread }: { conversationId: string; thread: Message[] | undefined }) {
  const { exchanges } = useChat();
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = log.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [thread, exchanges]);

  return (
    <div
      ref={log}
      role="log"
      aria-label="消息记录"
      tabIndex={0}
      className="h-80 min-h-0 flex-1 space-y-4 overflow-y-auto bg-background/60 px-4 py-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand lg:h-auto lg:px-6"
      aria-live="polite"
    >
      {!thread?.length && <p className="text-center text-sm text-muted">尚未发送消息</p>}
      {thread?.map((message, index) => (
        <MessageBubble key={`${message.time}-${index}`} message={message} />
      ))}
      <ChatExchangeList key={conversationId} conversationId={conversationId} />
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const mine = message.from === "me";
  const readLabel = messageReadLabel(message);
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] break-words rounded-lg px-4 py-3 text-sm leading-relaxed lg:max-w-[75%] lg:text-base ${mine ? "bg-brand text-white" : "border border-border bg-surface"}`}
      >
        <p>{message.text}</p>
        <p className={`mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${mine ? "text-white" : "text-muted"}`}>
          <span>{message.time}</span>
          <span data-message-read="" aria-label={mine ? `对方${readLabel}` : readLabel}>
            {readLabel}
          </span>
        </p>
      </div>
    </div>
  );
}
