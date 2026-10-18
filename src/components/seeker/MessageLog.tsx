"use client";

import { useEffect, useRef } from "react";
import { TriangleAlert } from "lucide-react";
import { useChat, type Conversation, type Message } from "@/components/seeker/chat-client";
import { ChatExchangeList, ChatReportButton } from "@/components/seeker/ChatInteractions";
import { incomingWarnings } from "@/components/seeker/chat-warnings";
import { messageReadLabel } from "@/lib/chat-activity";
import { teamSignature } from "@/components/employer/team";
import { useLang, useMessages } from "@/i18n/client";
import { contentLang } from "@/i18n/lang";
import { chatMessages } from "@/i18n/messages/chat";

/** The messages of one conversation, then its exchange requests; keeps the newest in view. */
export function MessageLog({ conversationId, thread }: { conversationId: string; thread: Message[] | undefined }) {
  const t = useMessages(chatMessages).log;
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
      aria-label={t.label}
      tabIndex={0}
      className="h-80 min-h-0 flex-1 space-y-4 overflow-y-auto bg-background/60 px-4 py-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand lg:h-auto lg:px-6"
      aria-live="polite"
    >
      {!thread?.length && <p className="text-center text-body text-muted">{t.empty}</p>}
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
  const t = useMessages(chatMessages).log;
  const lang = useLang();
  const mine = message.from === "me";
  const readLabel = messageReadLabel(message, lang);
  const warnings = mine ? [] : incomingWarnings(message.text, lang);
  // 「店名 · 名字」 (#110) or the team name: all of it is what people wrote, so one lang for the whole line.
  const by = message.by ? (mine ? message.by : teamSignature(conversation?.person ?? "", message.by)) : undefined;
  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[85%] animate-pop-in rounded-card px-4 py-2.5 text-body leading-relaxed break-words lg:max-w-[75%] ${mine ? "rounded-br-sm bg-brand text-white" : "rounded-bl-sm bg-surface shadow-card"}`}
      >
        <p lang={contentLang(message.text)}>{message.text}</p>
        <p
          className={`mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-meta ${mine ? "text-white" : "text-muted"}`}
        >
          {/* Who in the business's team sent it (#87): the team sees the name, the job seeker 「店名 · 名字」 (#110). */}
          {by && (
            <span data-message-by="" lang={contentLang(by)}>
              {by}
            </span>
          )}
          <span>{message.time}</span>
          <span data-message-read="" aria-label={mine ? t.counterpartRead(readLabel) : readLabel}>
            {readLabel}
          </span>
        </p>
      </div>
      {warnings.length > 0 && (
        <div
          role="note"
          aria-label={t.warningsLabel}
          className="mt-1.5 max-w-[85%] space-y-1 rounded-control bg-warn-soft px-3 py-2 text-meta leading-relaxed text-warn lg:max-w-[75%]"
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
              label={t.reportMessage}
            />
          )}
        </div>
      )}
    </div>
  );
}
