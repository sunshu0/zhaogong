"use client";

import { useEffect, useRef, useState } from "react";
import { Contact, FileText, Plus } from "lucide-react";
import { useChat } from "@/components/seeker/chat-client";
import { useMessages } from "@/i18n/client";
import { chatMessages } from "@/i18n/messages/chat";
import { visibleExchange, type Exchange, type ExchangeKind } from "@/lib/chat-consent";
import { CHAT_COMMAND_CLASS } from "@/components/seeker/ChatDialog";
import { ExchangeAction } from "@/components/seeker/ExchangeAction";
import { PayloadView } from "@/components/seeker/ExchangePayload";
import { SendResume } from "@/components/seeker/SendResume";
import { useSession } from "@/components/seeker/session-client";

const TOOLS: { kind: ExchangeKind; icon: typeof FileText }[] = [
  { kind: "resume", icon: FileText },
  { kind: "contact", icon: Contact },
];

/**
 * ＋ beside the message input: 交换资料 and 交换联系方式, and a job seeker's 发送我的简历 (#379). The panel stays open while one of its dialogs is open (the
 * dialog lives inside it); a tap outside or Escape closes it otherwise.
 */
export function ChatExchangeMenu({ conversationId }: { conversationId: string }) {
  const t = useMessages(chatMessages).exchangeMenu;
  const { exchanges } = useChat();
  const isEmployer = useSession()?.activeRole === "employer";
  const items = exchanges[conversationId] ?? [];
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const dialogOpen = () => Boolean(root.current?.querySelector("dialog[open]"));
    const onPointerDown = (e: PointerEvent) => {
      if (!dialogOpen() && !root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !dialogOpen()) {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-label={t.buttonLabel}
        aria-expanded={open}
        aria-controls={`exchange-tools-${conversationId}`}
        title={t.buttonLabel}
        onClick={() => setOpen((value) => !value)}
        className="pressable flex size-11 items-center justify-center rounded-full bg-background hover:text-brand aria-expanded:bg-brand-soft aria-expanded:text-brand"
      >
        <Plus aria-hidden="true" className="size-5" />
      </button>
      <div
        id={`exchange-tools-${conversationId}`}
        hidden={!open}
        role="group"
        aria-label={t.groupLabel}
        className="absolute bottom-full left-0 z-10 mb-2 w-max animate-pop-in space-y-1 rounded-control bg-surface p-2 shadow-pop"
      >
        {TOOLS.map((tool) => {
          const { kind } = tool;
          const current = items.find((item) => item.kind === kind && ["pending", "accepted"].includes(item.status));
          return (
            <div key={kind} className="*:w-full *:justify-start">
              <ExchangeTool conversationId={conversationId} tool={tool} current={current} />
            </div>
          );
        })}
        {/* #379: a job seeker's chat with a business on the platform (not a demo chat). */}
        {!isEmployer && conversationId.startsWith("employer:") && (
          <div className="*:w-full *:justify-start">
            <SendResume conversationId={conversationId} />
          </div>
        )}
      </div>
    </div>
  );
}

function ExchangeTool({
  conversationId,
  tool: { kind, icon: Icon },
  current,
}: {
  conversationId: string;
  tool: (typeof TOOLS)[number];
  current?: Exchange;
}) {
  const t = useMessages(chatMessages).exchangeMenu;
  const label = t[kind];
  const unavailable = current && (current.status === "accepted" || current.from === "me");
  if (unavailable) {
    const statusLabel = current.status === "accepted" ? t.done : t.waiting;
    return (
      <button type="button" disabled className={CHAT_COMMAND_CLASS}>
        <Icon aria-hidden="true" className="size-4" />
        {label}
        <span className="text-meta">{statusLabel}</span>
      </button>
    );
  }
  return (
    <ExchangeAction conversationId={conversationId} kind={kind} incoming={current}>
      <Icon aria-hidden="true" className="size-4" />
      {label}
    </ExchangeAction>
  );
}

export function ChatExchangeList({ conversationId }: { conversationId: string }) {
  const words = useMessages(chatMessages);
  const t = words.exchange;
  const kinds = words.exchangeKinds;
  const { exchanges, respondInfo } = useChat();
  const items = exchanges[conversationId] ?? [];
  return (
    <>
      {items.map((item) => {
        const visible = visibleExchange(item);
        return (
          <section
            key={item.id}
            aria-label={t.label(kinds[item.kind])}
            className="mx-auto max-w-2xl space-y-3 rounded-card bg-surface p-4 text-body ring-1 ring-border"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">
                {item.from === "me" ? t.titleMine(kinds[item.kind]) : t.titleTheirs(kinds[item.kind])}
              </h3>
              {item.demo && <span className="text-meta text-muted">{t.demo}</span>}
            </div>
            {item.status === "pending" && (
              <>
                <p className="text-meta leading-relaxed text-muted">
                  {item.from === "me" ? t.pendingMine : t.pendingTheirs}
                </p>
                <div className="flex flex-wrap gap-2">
                  <PendingExchangeActions
                    conversationId={conversationId}
                    item={item}
                    onRespond={(status) => respondInfo(conversationId, item.id, status)}
                  />
                </div>
              </>
            )}
            {item.status === "rejected" && (
              <p className="text-muted">{item.from === "me" ? t.rejectedMine : t.rejectedTheirs}</p>
            )}
            {item.status === "cancelled" && (
              <p className="text-muted">{item.from === "me" ? t.cancelledMine : t.cancelledTheirs}</p>
            )}
            {item.status === "accepted" && <p className="text-ok">{t.accepted}</p>}
            {visible && (
              <div className="grid gap-4 border-t border-border pt-3 sm:grid-cols-2">
                {visible.them && (
                  <div className="space-y-2">
                    <h4 className="font-medium">{t.theirPayload}</h4>
                    <PayloadView payload={visible.them} />
                  </div>
                )}
                {visible.me && (
                  <div className="space-y-2">
                    <h4 className="font-medium">{item.status === "pending" ? t.myPayloadPending : t.myPayload}</h4>
                    <PayloadView payload={visible.me} />
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })}
    </>
  );
}

function PendingExchangeActions({
  conversationId,
  item,
  onRespond,
}: {
  conversationId: string;
  item: Exchange;
  onRespond: (status: "cancelled" | "rejected") => void;
}) {
  const t = useMessages(chatMessages).exchange;
  if (item.from === "me") {
    return (
      <button type="button" className={CHAT_COMMAND_CLASS} onClick={() => onRespond("cancelled")}>
        {t.withdraw}
      </button>
    );
  }
  return (
    <>
      <ExchangeAction conversationId={conversationId} kind={item.kind} incoming={item}>
        {t.viewAndAgree}
      </ExchangeAction>
      <button type="button" className={CHAT_COMMAND_CLASS} onClick={() => onRespond("rejected")}>
        {t.refuse}
      </button>
    </>
  );
}
