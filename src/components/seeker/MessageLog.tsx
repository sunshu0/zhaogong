"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { FileUser, TriangleAlert } from "lucide-react";
import { useChat, useChatDelivery, type Conversation, type Message } from "@/components/seeker/chat-client";
import { ChatExchangeList, ChatReportButton } from "@/components/seeker/ChatInteractions";
import { incomingWarnings, sentWarningParts } from "@/components/seeker/chat-warnings";
import { messageReadLabel } from "@/lib/chat-activity";
import { teamSignature } from "@/components/employer/team";
import { useLang, useMessages } from "@/i18n/client";
import { contentLang } from "@/i18n/lang";
import { chatMessages } from "@/i18n/messages/chat";
import { shownTime, type ResumeCard } from "@/components/seeker/chat-store";

/** How close to the bottom counts as reading the newest (#282): about two lines of messages. */
const NEAR_BOTTOM_PX = 80;

/** The messages of one conversation, then its exchange requests; keeps the newest in view while it is being read. */
export function MessageLog({ conversationId, thread }: { conversationId: string; thread: Message[] | undefined }) {
  const t = useMessages(chatMessages).log;
  const { exchanges, conversations } = useChat();
  const { unsent } = useChatDelivery(conversationId);
  const conversation = conversations.find((item) => item.id === conversationId);
  // The last `unsent` of this browser's own messages are the ones the outbox still holds (#253): it goes oldest first.
  const mineAt = (thread ?? []).flatMap((message, index) => (message.from === "me" ? [index] : []));
  const unsentFrom = unsent ? (mineAt[mineAt.length - unsent] ?? 0) : Infinity;
  const log = useRef<HTMLDivElement>(null);
  // #282: follow new messages only from near the bottom, or for one this person just sent; someone reading older
  // messages is not pulled down by the 10-second read or the other side's reply. A new conversation mounts this
  // log afresh (ChatThread is keyed by it), so it opens at the bottom.
  const nearBottom = useRef(true);
  const shown = useRef(0);
  useEffect(() => {
    const element = log.current;
    const count = thread?.length ?? 0;
    const sentNow = count > shown.current && thread?.[count - 1]?.from === "me";
    shown.current = count;
    if (element && (nearBottom.current || sentNow)) element.scrollTop = element.scrollHeight;
  }, [thread, exchanges]);

  return (
    <div
      ref={log}
      onScroll={(event) => {
        const element = event.currentTarget;
        nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < NEAR_BOTTOM_PX;
      }}
      role="log"
      aria-label={t.label}
      tabIndex={0}
      className="h-80 min-h-0 flex-1 space-y-4 overflow-y-auto bg-background/60 px-4 py-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand lg:h-auto lg:px-6"
      aria-live="polite"
    >
      {!thread?.length && <p className="text-center text-body text-muted">{t.empty}</p>}
      {thread?.map((message, index) => (
        <MessageBubble
          key={`${message.time}-${index}`}
          message={message}
          index={index}
          conversation={conversation}
          unsent={message.from === "me" && index >= unsentFrom}
        />
      ))}
      <ChatExchangeList key={conversationId} conversationId={conversationId} />
    </div>
  );
}

/**
 * A sent 中英文简历 (#379, ADR 0037): whose it is and which contact details it carries; 查看简历 opens the page as sent.
 * Until the server has it (id 0) it says 发送中.
 */
function ResumeCardView({ card, mine }: { card: ResumeCard; mine: boolean }) {
  const t = useMessages(chatMessages);
  const words = t.resumeCard;
  const names = t.resumeSend;
  return (
    <div data-resume-card="" className="flex items-start gap-3" aria-label={words.label(card.name)} role="group">
      <FileUser aria-hidden="true" className="mt-1 size-6 shrink-0" />
      <div className="min-w-0 space-y-0.5">
        <p className="font-semibold">
          {words.heading} · <span lang={contentLang(card.name)}>{card.name}</span>
        </p>
        <p className={`text-meta ${mine ? "text-white" : "text-muted"}`}>
          {card.contact.length
            ? words.carries(card.contact.map((key) => names.contactNames[key]).join(names.listJoin))
            : words.carriesNone}
        </p>
        {card.id ? (
          <Link
            href={`/messages/resume/${card.id}`}
            className={`inline-flex min-h-11 items-center font-medium underline underline-offset-4 ${mine ? "text-white" : "text-brand"}`}
          >
            {words.open}
          </Link>
        ) : (
          <p className="text-meta">{words.sending}</p>
        )}
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  index,
  conversation,
  unsent = false,
}: {
  message: Message;
  index: number;
  conversation?: Conversation;
  /** Still in the outbox (#253): 未送出 in place of the read state. */
  unsent?: boolean;
}) {
  const delivery = useMessages(chatMessages).delivery;
  const t = useMessages(chatMessages).log;
  const lang = useLang();
  const mine = message.from === "me";
  const readLabel = messageReadLabel(message, lang);
  const warnings = mine || message.resume ? [] : incomingWarnings(message.text, lang);
  // #384: one's own message that hits the chat rules went as it was; a line under it says the other side is warned.
  const sentWarning = mine && !message.resume ? sentWarningParts(message.text, lang) : undefined;
  // 「店名 · 名字」 (#110) or the team name: all of it is what people wrote, so one lang for the whole line.
  const by = message.by ? (mine ? message.by : teamSignature(conversation?.person ?? "", message.by)) : undefined;
  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[85%] animate-pop-in rounded-card px-4 py-2.5 text-body leading-relaxed break-words lg:max-w-[75%] ${mine ? "rounded-br-sm bg-brand text-white" : "rounded-bl-sm bg-surface shadow-card"}`}
      >
        {message.resume ? (
          <ResumeCardView card={message.resume} mine={mine} />
        ) : (
          <p lang={contentLang(message.text)}>{message.text}</p>
        )}
        <p
          className={`mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-meta ${mine ? "text-white" : "text-muted"}`}
        >
          {/* Who in the business's team sent it (#87): the team sees the name, the job seeker 「店名 · 名字」 (#110). */}
          {by && (
            <span data-message-by="" lang={contentLang(by)}>
              {by}
            </span>
          )}
          <span>{shownTime(message.time, lang)}</span>
          {unsent ? (
            <span data-message-unsent="" className="font-medium">
              {delivery.unsent}
            </span>
          ) : (
            <span data-message-read="" aria-label={mine ? t.counterpartRead(readLabel) : readLabel}>
              {readLabel}
            </span>
          )}
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
      {sentWarning && (
        <p
          role="note"
          aria-label={t.sentWarningsLabel}
          className="mt-1.5 flex max-w-[85%] gap-1.5 rounded-control bg-warn-soft px-3 py-2 text-meta leading-relaxed text-warn lg:max-w-[75%]"
        >
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {sentWarning.before}
            <span lang={contentLang(sentWarning.words)}>{sentWarning.words}</span>
            {sentWarning.after}
          </span>
        </p>
      )}
    </div>
  );
}
