"use client";

import { useEffect, useRef } from "react";
import { TriangleAlert } from "lucide-react";
import { useChat, type Conversation, type Message } from "@/components/seeker/chat-client";
import { ChatExchangeList, ChatReportButton } from "@/components/seeker/ChatInteractions";
import { incomingWarnings } from "@/components/seeker/chat-warnings";
import { messageReadLabel } from "@/lib/chat-activity";

/** The messages of one conversation, then its exchange requests; keeps the newest in view. */
export function MessageLog({ conversationId, thread }: { conversationId: string; thread: Message[] | undefined }) {
  const { exchanges, conversations } = useChat();
  const conversation = conversations.find((item) => item.id === conversationId);
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
        <MessageBubble key={`${message.time}-${index}`} message={message} index={index} conversation={conversation} />
      ))}
      <ChatExchangeList key={conversationId} conversationId={conversationId} />
    </div>
  );
}

function MessageBubble({
  message,
  index,
  conversation,
}: {
  message: Message;
  index: number;
  conversation?: Conversation;
}) {
  const mine = message.from === "me";
  const readLabel = messageReadLabel(message);
  const warnings = mine ? [] : incomingWarnings(message.text);
  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[85%] break-words rounded-md px-4 py-3 text-sm leading-relaxed lg:max-w-[75%] lg:text-base ${mine ? "bg-brand text-white" : "border border-border bg-surface"}`}
      >
        <p>{message.text}</p>
        <p className={`mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${mine ? "text-white" : "text-muted"}`}>
          {/* Who in the business's team sent it (#87); the business side shares one set of conversations. */}
          {mine && message.by && <span data-message-by="">{message.by}</span>}
          <span>{message.time}</span>
          <span data-message-read="" aria-label={mine ? `对方${readLabel}` : readLabel}>
            {readLabel}
          </span>
        </p>
      </div>
      {warnings.length > 0 && (
        <div
          role="note"
          aria-label="合规提醒"
          className="mt-1.5 max-w-[85%] space-y-1 rounded-md bg-warn-soft px-3 py-2 text-xs leading-relaxed text-warn lg:max-w-[75%]"
        >
          {warnings.map((warning) => (
            <p key={warning.rule} className="flex gap-1.5">
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              {warning.text}
            </p>
          ))}
          {conversation && (
            <ChatReportButton
              conversation={conversation}
              messageIndex={index}
              reason={warnings[0].reportReason}
              label="举报这条消息"
            />
          )}
        </div>
      )}
    </div>
  );
}
