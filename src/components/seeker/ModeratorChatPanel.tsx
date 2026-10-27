"use client";

// 审核员和雇主聊天 (#407, ADR 0046): one conversation between a business and the moderators, as either side shows it —
// the business in 消息 (ModeratorThread), the moderators in /admin (ModeratorChats). Only words: no job strip,
// exchanges, résumés, 常用语, chat rule reminders or 举报, which belong to the job seekers' chats.
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { MessageComposer } from "@/components/seeker/ChatThread";
import { useLang, useMessages } from "@/i18n/client";
import { contentLang } from "@/i18n/lang";
import { formatDate } from "@/i18n/format";
import { moderatorChatMessages } from "@/i18n/messages/moderator-chat";
import type { ModeratorChatLine } from "@/lib/moderator-chat";
import type { SendOutcome } from "@/components/seeker/moderator-chat-client";

const TIME: Intl.DateTimeFormatOptions = { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" };

/** How close to the bottom counts as reading the newest (MessageLog's NEAR_BOTTOM_PX). */
const NEAR_BOTTOM_PX = 80;

export function ModeratorChatPanel({
  label,
  heading,
  avatar,
  note,
  lines,
  signature,
  onSend,
  onBack,
  backLabel,
}: {
  label: string;
  heading: string;
  avatar: ReactNode;
  /** Said at the top of the messages: who can see them. */
  note: string;
  lines: ModeratorChatLine[];
  /** The name shown under a message, if any. */
  signature: (line: ModeratorChatLine) => string | undefined;
  onSend: (text: string) => Promise<SendOutcome>;
  onBack: () => void;
  backLabel: string;
}) {
  const t = useMessages(moderatorChatMessages);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(undefined);
    const outcome = await onSend(text);
    setBusy(false);
    if (outcome.sent) setDraft("");
    else setError(outcome.error ?? t.sendFailed);
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-col" aria-label={label}>
      <div className="flex items-center gap-3 border-b border-border px-4 py-2 lg:py-3">
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel}
          title={backLabel}
          className="pressable -ml-2 flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-background lg:hidden"
        >
          <ArrowLeft aria-hidden="true" className="size-5" />
        </button>
        {avatar}
        <h2 lang={contentLang(heading)} className="min-w-0 flex-1 truncate text-subtitle font-semibold">
          {heading}
        </h2>
      </div>
      <ModeratorChatLog note={note} lines={lines} signature={signature} />
      <div className="shrink-0 border-t border-border px-4 py-2 lg:px-6 lg:py-4">
        {error && (
          <p role="alert" className="mb-2 text-meta text-danger">
            {error}
          </p>
        )}
        <MessageComposer draft={draft} onDraftChange={setDraft} onSubmit={submit} warn={false} busy={busy} />
      </div>
    </section>
  );
}

function ModeratorChatLog({
  note,
  lines,
  signature,
}: {
  note: string;
  lines: ModeratorChatLine[];
  signature: (line: ModeratorChatLine) => string | undefined;
}) {
  const t = useMessages(moderatorChatMessages);
  const lang = useLang();
  const log = useRef<HTMLDivElement>(null);
  // As MessageLog (#282): follow new messages from near the bottom, or one this side just sent.
  const nearBottom = useRef(true);
  const shown = useRef(0);
  useEffect(() => {
    const element = log.current;
    const sentNow = lines.length > shown.current && lines.at(-1)?.mine;
    shown.current = lines.length;
    if (element && (nearBottom.current || sentNow)) element.scrollTop = element.scrollHeight;
  }, [lines]);
  return (
    <div
      ref={log}
      onScroll={(event) => {
        const element = event.currentTarget;
        nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < NEAR_BOTTOM_PX;
      }}
      role="log"
      aria-label={t.logLabel}
      aria-live="polite"
      tabIndex={0}
      className="h-80 min-h-0 flex-1 space-y-4 overflow-y-auto bg-background/60 px-4 py-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand lg:h-auto lg:px-6"
    >
      <p className="text-center text-meta text-muted">{note}</p>
      {!lines.length && <p className="text-center text-body text-muted">{t.empty}</p>}
      {lines.map((line) => {
        const by = signature(line);
        return (
          <div key={line.id} className={`flex flex-col ${line.mine ? "items-end" : "items-start"}`}>
            <div
              className={`max-w-[85%] rounded-card px-4 py-2.5 text-body leading-relaxed break-words lg:max-w-[75%] ${line.mine ? "rounded-br-sm bg-brand text-white" : "rounded-bl-sm bg-surface ring-1 ring-border"}`}
            >
              <p lang={contentLang(line.text)} className="whitespace-pre-wrap">
                {line.text}
              </p>
              <p
                className={`mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-meta ${line.mine ? "text-white" : "text-muted"}`}
              >
                {by && (
                  <span data-message-by="" lang={contentLang(by)}>
                    {by}
                  </span>
                )}
                <time dateTime={line.sentAt}>{formatDate(line.sentAt, lang, TIME)}</time>
                {line.read !== undefined && <span data-message-read="">{line.read ? t.read : t.notRead}</span>}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
