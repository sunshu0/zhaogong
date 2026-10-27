"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { crashForTests } from "@/lib/test-crash";
import { ArrowLeft, Send } from "lucide-react";
import { conversationProfileHref, useChat, useChatDelivery, type Conversation } from "@/components/seeker/chat-client";
import { ChatActivity } from "@/components/seeker/ChatActivity";
import { ChatPhraseRow } from "@/components/seeker/ChatPhrases";
import { ChatExchangeMenu } from "@/components/seeker/ChatInteractions";
import { ChatReportDialog } from "@/components/seeker/ChatReportButton";
import { ConversationJob } from "@/components/seeker/ConversationJob";
import { ChatCandidateMarks } from "@/components/employer/ChatCandidateMarks";
import { MoreMenu, type MoreMenuItem } from "@/components/ui/MoreMenu";
import { MessageLog } from "@/components/seeker/MessageLog";
import { CounterpartAvatar } from "@/components/seeker/ProfileAvatar";
import { outgoingWarningParts } from "@/components/seeker/chat-warnings";
import { MESSAGE_COUNT_FROM, MESSAGE_MAX } from "@/components/seeker/chat-store";
import { FULLSCREEN_CHAT_QUERY, useKeyboardUp } from "@/components/seeker/fullscreen-chat";
import { useMediaQuery } from "@/components/ui/use-media-query";
import { useLang, useMessages } from "@/i18n/client";
import { contentLang } from "@/i18n/lang";
import { chatMessages } from "@/i18n/messages/chat";

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
  crashForTests("chat");
  const t = useMessages(chatMessages).thread;
  const lang = useLang();
  const { messages, conversations, send } = useChat();
  const thread = useRef<HTMLElement>(null);
  const keyboardUp = useKeyboardUp(thread, useMediaQuery(FULLSCREEN_CHAT_QUERY, false));

  function submit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    send(conversation.id, text);
    onDraftChange("");
  }

  // 常用语 (#372): one press sends it, beside whatever is being written. One the chat rules warn about goes into the
  // box instead, where the warning shows as for anything typed, and the person decides.
  function sendPhrase(phrase: string) {
    if (outgoingWarningParts(phrase, lang)) onDraftChange(draft.trim() ? `${draft.trimEnd()} ${phrase}` : phrase);
    else send(conversation.id, phrase);
  }

  return (
    <section ref={thread} className="flex min-h-0 min-w-0 flex-col" aria-label={t.label(conversation.person)}>
      <ThreadHeader conversation={conversation} isEmployer={isEmployer} onBack={onBack} />
      {/* #405: while the phone's keyboard is up, the job bar and the marks fold away (kept, not reloaded) so the
          messages keep the room; they are back when it goes down. #415: the activity lines and the 常用语 row too
          (the row keeps its 管理 dialog showing, so a field in it can have the keyboard). DeliveryNote stays. */}
      <Folded folded={keyboardUp}>
        {conversation.job && <ConversationJob jobId={conversation.job} fallbackTitle={conversation.title} />}
        {/* ADR 0030: the business marks the job seeker here too. */}
        {isEmployer && conversation.job && conversation.id.startsWith("chat:") && (
          <ChatCandidateMarks conversationId={conversation.id} jobId={conversation.job} />
        )}
      </Folded>
      <DeliveryNote conversationId={conversation.id} />

      <Folded folded={keyboardUp}>
        <ChatActivity
          conversation={conversation}
          isEmployer={isEmployer}
          conversations={conversations}
          messages={messages}
        />
      </Folded>

      <MessageLog conversationId={conversation.id} thread={messages[conversation.id]} />

      <div className="shrink-0 border-t border-border px-4 py-2 lg:px-6 lg:py-4">
        {conversation.paused ? (
          // A business under a ban (ADR 0044): nothing goes either way until it is over; the line says so up front.
          <p role="status" className="py-2 text-body text-muted">
            {t.paused}
          </p>
        ) : (
          <>
            <ChatPhraseRow role={isEmployer ? "employer" : "seeker"} onPick={sendPhrase} folded={keyboardUp} />
            <MessageComposer
              draft={draft}
              onDraftChange={onDraftChange}
              onSubmit={submit}
              tools={<ChatExchangeMenu key={conversation.id} conversationId={conversation.id} />}
            />
          </>
        )}
      </div>
    </section>
  );
}

/** What folds away while the phone's keyboard is up (#405, #415): hidden, not unmounted. */
function Folded({ folded, children }: { folded: boolean; children: ReactNode }) {
  return (
    <div className={folded ? "hidden" : "contents"} data-folded={folded || undefined}>
      {children}
    </div>
  );
}

/**
 * What this conversation has not got to the server (#253): the outbox keeps it and sends it again, but the person
 * should know it has not arrived, and that the messages shown may not be the latest when the server is out of reach.
 */
function DeliveryNote({ conversationId }: { conversationId: string }) {
  const t = useMessages(chatMessages).delivery;
  const { waiting, unreached, retry } = useChatDelivery(conversationId);
  if (!waiting && !unreached) return null;
  return (
    <div
      role="status"
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-warn-soft px-4 py-2 text-meta text-warn lg:px-6"
    >
      <p>{waiting ? t.waiting(waiting) : t.unreached}</p>
      <button type="button" onClick={retry} className="pressable min-h-11 font-medium underline underline-offset-2">
        {t.retry}
      </button>
    </div>
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
  const t = useMessages(chatMessages).thread;
  const [reporting, setReporting] = useState(false);
  const profileHref = conversationProfileHref(conversation, isEmployer);
  // 更多: their page, the job, 举报 — so the header keeps only back, who, and this one button.
  const more: MoreMenuItem[] = [
    ...(profileHref ? [{ label: isEmployer ? t.seekerProfile : t.employerProfile, href: profileHref }] : []),
    ...(conversation.job ? [{ label: t.viewJob, href: `/jobs/${conversation.job}` }] : []),
    { label: t.report, danger: true, onSelect: () => setReporting(true) },
  ];
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-2 lg:py-3">
      <button
        type="button"
        onClick={onBack}
        aria-label={t.back}
        title={t.back}
        className="pressable -ml-2 flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-background lg:hidden"
      >
        <ArrowLeft aria-hidden="true" className="size-5" />
      </button>
      <Counterpart conversation={conversation} isEmployer={isEmployer} />
      <MoreMenu items={more} label={t.more(conversation.person)} />
      {reporting && (
        <ChatReportDialog key={conversation.id} conversation={conversation} onClose={() => setReporting(false)} />
      )}
    </div>
  );
}

/** Avatar, name and job of the other person; a link to their public page when they have one. */
function Counterpart({ conversation, isEmployer }: { conversation: Conversation; isEmployer: boolean }) {
  const t = useMessages(chatMessages).thread;
  const profileHref = conversationProfileHref(conversation, isEmployer);
  // Only when there is no job strip under the header (it names the job already).
  // The job's title is what the employer wrote, so it carries its own lang inside the dictionary's line.
  const job = conversation.job ? null : (
    <p className="truncate text-meta text-muted">
      {isEmployer ? t.appliedFor : t.hiringFor}
      <span lang={contentLang(conversation.title)}>{conversation.title}</span>
    </p>
  );
  if (!profileHref) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <CounterpartAvatar conversation={conversation} isEmployer={isEmployer} />
        <div className="min-w-0">
          <h2 lang={contentLang(conversation.person)} className="truncate text-subtitle font-semibold">
            {conversation.person}
          </h2>
          {job}
        </div>
      </div>
    );
  }
  return (
    <Link
      href={profileHref}
      aria-label={t.viewProfile(conversation.person)}
      title={t.viewProfile(conversation.person)}
      className="group pressable flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-control focus-visible:outline-2 focus-visible:outline-brand"
    >
      <CounterpartAvatar conversation={conversation} isEmployer={isEmployer} />
      <div className="min-w-0">
        <h2
          lang={contentLang(conversation.person)}
          className="text-subtitle leading-snug font-semibold break-words group-hover:text-brand group-hover:underline sm:truncate"
        >
          {conversation.person}
        </h2>
        {job}
      </div>
    </Link>
  );
}

export function MessageComposer({
  draft,
  onDraftChange,
  onSubmit,
  tools,
  warn = true,
  busy = false,
}: {
  draft: string;
  onDraftChange: (draft: string) => void;
  onSubmit: (event: FormEvent) => void;
  /** The ＋ menu (exchanges) beside the input. */
  tools?: ReactNode;
  /** The chat rules' reminder while writing; not in a conversation with the moderators (ADR 0046). */
  warn?: boolean;
  /** A send on its way: 发送 waits. */
  busy?: boolean;
}) {
  const t = useMessages(chatMessages).thread;
  const lang = useLang();
  // A reminder while writing; the message can still be sent. The words it quotes are the writer's own.
  const warning = warn ? outgoingWarningParts(draft, lang) : undefined;
  const box = useRef<HTMLTextAreaElement>(null);
  const send = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    if (box.current) fitToText(box.current);
  }, [draft]);
  // #202: the draft empties and 发送 turns disabled; after a press on it the focus goes back to the box.
  const submit = (event: FormEvent) => {
    const pressed = document.activeElement === send.current;
    onSubmit(event);
    if (pressed) box.current?.focus();
  };
  // #259: the count shows near the server's limit, which the box does not let a message pass.
  const counting = draft.length >= MESSAGE_COUNT_FROM;
  const describedBy = [warning && "message-draft-warning", counting && "message-draft-count"].filter(Boolean).join(" ");
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      {tools}
      <label className="sr-only" htmlFor="message-draft">
        {t.composerLabel}
      </label>
      <textarea
        ref={box}
        id="message-draft"
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        placeholder={t.composerPlaceholder}
        rows={1}
        maxLength={MESSAGE_MAX}
        aria-describedby={describedBy || undefined}
        // #260: Ctrl+Enter (⌘+Enter on a Mac) sends, as 发送 does; Enter alone is a new line, and not while an input
        // method is still choosing characters.
        aria-keyshortcuts="Control+Enter Meta+Enter"
        onKeyDown={(event) => {
          if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey) || event.nativeEvent.isComposing) return;
          event.preventDefault();
          event.currentTarget.form?.requestSubmit();
        }}
        className={`${GROWING_BOX} min-w-0 flex-1 resize-none rounded-control border border-border bg-background px-3.5 py-2.5 text-base outline-none focus:border-brand focus:bg-surface focus:ring-2 focus:ring-brand/20`}
      />
      <button
        ref={send}
        type="submit"
        disabled={busy || !draft.trim()}
        className="pressable inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 py-2 text-body font-semibold text-white hover:bg-accent-strong active:bg-accent-strong disabled:opacity-50"
      >
        <Send aria-hidden="true" className="size-4" />
        {t.send}
      </button>
      {counting && (
        <p id="message-draft-count" className="basis-full text-right text-meta text-muted tabular-nums">
          {draft.length}/{MESSAGE_MAX}
        </p>
      )}
      {warning && (
        <p id="message-draft-warning" role="status" className="basis-full text-meta leading-relaxed text-warn">
          {warning.before}
          <span lang={contentLang(warning.words)}>{warning.words}</span>
          {warning.after}
        </p>
      )}
    </form>
  );
}

/**
 * T1 (ADR 0042): on a phone the box starts at one line and grows with what is typed up to about five (9rem: five
 * 1.5rem lines, the padding and the border), then scrolls inside. From 1024 px it keeps the three lines it always had.
 */
const GROWING_BOX =
  "min-h-11 max-h-36 overflow-y-auto [field-sizing:content] lg:h-[5.875rem] lg:max-h-none lg:[field-sizing:fixed]";

/** Where `field-sizing: content` is missing (Firefox, older Safari), the box is sized to its text on each change. */
function fitToText(element: HTMLTextAreaElement) {
  if (CSS.supports("field-sizing", "content")) return;
  element.style.height = "";
  if (!window.matchMedia(FULLSCREEN_CHAT_QUERY).matches) return;
  // max-h-36 caps it; the border is outside scrollHeight.
  element.style.height = `${element.scrollHeight + element.offsetHeight - element.clientHeight}px`;
}
