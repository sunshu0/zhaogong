"use client";

import { useState, useTransition } from "react";
import { TriangleAlert } from "lucide-react";
import type { AdminResult, Refused } from "@/app/[lang]/admin/actions";
import { closeChatRiskItem, getChatRiskMessages, getChatRiskQueue } from "@/app/[lang]/admin/chat-risk-actions";
import { isFailed, settle, type Failed } from "@/app/[lang]/admin/load-state";
import { Empty, Loading } from "@/app/[lang]/admin/_components/Empty";
import { LoadFailed, TryAgain } from "@/app/[lang]/admin/_components/Failed";
import { useAdminLoad } from "@/app/[lang]/admin/_components/use-admin-load";
import type { ChatRiskItem, ChatRiskMessage } from "@/db/chat-risk";
import { Button } from "@/components/ui/Button";
import { sheetClass } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import { useServerLoad } from "@/components/ui/use-server-load";
import { useLang, useMessages } from "@/i18n/client";
import { contentLang } from "@/i18n/lang";
import { formatDate } from "@/i18n/format";
import { adminMessages } from "@/i18n/messages/admin";
import { adminViewsMessages } from "@/i18n/messages/admin-views";

// When a message was sent: day and time, New Zealand time (format.ts).
const TIME: Intl.DateTimeFormatOptions = { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" };

/** The open 聊天风险 items (#384, ADR 0039), loaded again whenever `version` changes; the tab counts from it. */
export function useChatRiskQueue(version: number) {
  return useAdminLoad<{ items: ChatRiskItem[] } | Refused>(getChatRiskQueue, version);
}

/**
 * 聊天风险: businesses whose chat messages hit the chat rules CHAT_RISK_THRESHOLD times within the window. Each card
 * says which kinds, how many and when; the messages open behind a button, as a report's evidence does, and the
 * server records the view before it answers.
 */
export function ChatRiskQueue({
  queue,
  onDone,
  onRetry,
}: {
  queue?: { items: ChatRiskItem[] } | Refused | Failed;
  onDone: (result: AdminResult) => void;
  onRetry: () => void;
}) {
  const t = useMessages(adminViewsMessages).chatRisk;
  if (isFailed(queue)) return <LoadFailed what={t.name} onRetry={onRetry} />;
  if (!queue) return <Loading />;
  if ("refused" in queue) return <Empty>{queue.error_zh}</Empty>;
  return (
    <>
      <p className="mb-3 text-meta text-muted">{t.howTo}</p>
      {queue.items.length === 0 ? (
        <Empty>{t.empty}</Empty>
      ) : (
        <ul className="space-y-3">
          {queue.items.map((item) => (
            <li key={item.employerId}>
              <ChatRiskCard item={item} onDone={onDone} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function ChatRiskCard({ item, onDone }: { item: ChatRiskItem; onDone: (result: AdminResult) => void }) {
  const lang = useLang();
  const t = useMessages(adminViewsMessages).chatRisk;
  const rules = useMessages(adminMessages).rules;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false); // #183: no answer came; the card stays as it was
  const close = () => {
    setFailed(false);
    startTransition(async () => {
      const result = await settle(() => closeChatRiskItem(item.employerId));
      if (result) onDone(result);
      else setFailed(true);
    });
  };
  return (
    <article aria-label={t.cardLabel(item.employerName)} className={sheetClass()}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 lang={contentLang(item.employerName)} className="text-subtitle font-semibold">
          {item.employerName}
        </h2>
        <span className="text-meta text-muted">{item.employerId}</span>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-body">
        <TriangleAlert aria-hidden="true" className="size-4 shrink-0 text-warn" />
        {item.rules.map((rule) => (
          <Tag key={rule} kind="urgent">
            {rules[rule]}
          </Tag>
        ))}
        <span>{t.count(item.count)}</span>
        <span className="text-meta text-muted">{t.last(formatDate(item.lastAt, lang, TIME))}</span>
      </p>
      <div className="mt-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="pressable min-h-11 text-body font-medium text-brand underline underline-offset-4"
        >
          {open ? t.close : t.open(item.count)}
        </button>
        {open && <Messages employerId={item.employerId} />}
      </div>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
        <Button variant="secondary" loading={pending} onClick={close}>
          {t.closeItem}
        </Button>
      </div>
      {failed && (
        <div className="mt-3">
          <TryAgain />
        </div>
      )}
    </article>
  );
}

function Messages({ employerId }: { employerId: string }) {
  const lang = useLang();
  const t = useMessages(adminViewsMessages).chatRisk;
  const rules = useMessages(adminMessages).rules;
  const { value, failed, reload } = useServerLoad<{ messages: ChatRiskMessage[] } | Refused>(employerId, () =>
    getChatRiskMessages(employerId),
  );
  if (failed) return <LoadFailed what={t.name} onRetry={reload} />;
  if (!value) return <Loading cards={1} height="h-20" />;
  if ("refused" in value) return <p className="text-body text-muted">{value.error_zh}</p>;
  if (value.messages.length === 0) return <p className="text-body text-muted">{t.none}</p>;
  return (
    <div className="mt-1 space-y-3 rounded-control bg-surface p-3 ring-1 ring-border">
      <p className="text-meta text-muted">{t.note}</p>
      <ol aria-label={t.messagesLabel} className="space-y-2">
        {value.messages.map((m) => (
          <li key={m.messageId} className="text-body">
            <span className="block text-meta text-muted">
              {t.employer(m.byName)} · <time dateTime={m.sentAt}>{formatDate(m.sentAt, lang, TIME)}</time> ·{" "}
              {t.conversation(m.conversationId)} · {m.rules.map((rule) => rules[rule]).join(" · ")}
            </span>
            <span lang={contentLang(m.text)} className="break-words whitespace-pre-line">
              {m.text}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
