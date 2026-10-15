"use client";

import { useEffect, useRef, useState } from "react";
import { Contact, FileText, Plus } from "lucide-react";
import { useChat } from "@/components/seeker/chat-client";
import { EXCHANGE_LABELS, visibleExchange, type Exchange } from "@/lib/chat-consent";
import { CHAT_COMMAND_CLASS } from "@/components/seeker/ChatDialog";
import { ExchangeAction } from "@/components/seeker/ExchangeAction";
import { PayloadView } from "@/components/seeker/ExchangePayload";

const TOOLS = [
  { kind: "resume" as const, label: "交换资料", icon: FileText },
  { kind: "contact" as const, label: "交换联系方式", icon: Contact },
];

/**
 * ＋ beside the message input: 交换资料 and 交换联系方式. The panel stays open while one of its dialogs is open (the
 * dialog lives inside it); a tap outside or Escape closes it otherwise.
 */
export function ChatExchangeMenu({ conversationId }: { conversationId: string }) {
  const { exchanges } = useChat();
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
        aria-label="交换资料或联系方式"
        aria-expanded={open}
        aria-controls={`exchange-tools-${conversationId}`}
        title="交换资料或联系方式"
        onClick={() => setOpen((value) => !value)}
        className="flex size-11 items-center justify-center rounded-lg border border-border hover:border-brand aria-expanded:border-brand aria-expanded:text-brand"
      >
        <Plus aria-hidden="true" className="size-5" />
      </button>
      <div
        id={`exchange-tools-${conversationId}`}
        hidden={!open}
        role="group"
        aria-label="沟通工具"
        className="absolute bottom-full left-0 z-10 mb-2 w-max space-y-1 rounded-lg border border-border bg-surface p-2 shadow-lg"
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
      </div>
    </div>
  );
}

function ExchangeTool({
  conversationId,
  tool: { kind, label, icon: Icon },
  current,
}: {
  conversationId: string;
  tool: (typeof TOOLS)[number];
  current?: Exchange;
}) {
  const unavailable = current && (current.status === "accepted" || current.from === "me");
  if (unavailable) {
    const statusLabel = current.status === "accepted" ? "已交换" : "待同意";
    return (
      <button type="button" disabled className={CHAT_COMMAND_CLASS}>
        <Icon aria-hidden="true" className="size-4" />
        {label}
        <span className="text-xs">{statusLabel}</span>
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
  const { exchanges, respondInfo } = useChat();
  const items = exchanges[conversationId] ?? [];
  return (
    <>
      {items.map((item) => {
        const visible = visibleExchange(item);
        return (
          <section
            key={item.id}
            aria-label={`${EXCHANGE_LABELS[item.kind]}交换请求`}
            className="mx-auto max-w-2xl space-y-3 rounded-lg border border-border bg-surface p-4 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">
                {item.from === "me" ? "你申请" : "对方申请"}交换{EXCHANGE_LABELS[item.kind]}
              </h3>
              {item.demo && <span className="text-xs text-muted">演示请求</span>}
            </div>
            {item.status === "pending" && (
              <>
                <p className="text-xs leading-relaxed text-muted">
                  {item.from === "me"
                    ? "你已提供自己的资料，对方现在能看到。等待对方同意后，你会看到对方的资料。"
                    : "对方已先提供自己的资料。你同意后，对方才会看到你的资料；也可以拒绝。"}
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
              <p className="text-muted">
                {item.from === "me" ? "对方已拒绝，没有给出资料。" : "你已拒绝，你的资料没有给对方。"}
              </p>
            )}
            {item.status === "cancelled" && (
              <p className="text-muted">
                请求已撤回，{item.from === "me" ? "对方不再看到你的资料" : "对方的资料已收回"}。
              </p>
            )}
            {item.status === "accepted" && <p className="text-ok">双方已同意，资料已交换。</p>}
            {visible && (
              <div className="grid gap-4 border-t border-border pt-3 sm:grid-cols-2">
                {visible.them && (
                  <div className="space-y-2">
                    <h4 className="font-medium">对方的资料</h4>
                    <PayloadView payload={visible.them} />
                  </div>
                )}
                {visible.me && (
                  <div className="space-y-2">
                    <h4 className="font-medium">{item.status === "pending" ? "我提供的资料" : "我的资料"}</h4>
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
  if (item.from === "me") {
    return (
      <button type="button" className={CHAT_COMMAND_CLASS} onClick={() => onRespond("cancelled")}>
        撤回请求
      </button>
    );
  }
  return (
    <>
      <ExchangeAction conversationId={conversationId} kind={item.kind} incoming={item}>
        查看并同意
      </ExchangeAction>
      <button type="button" className={CHAT_COMMAND_CLASS} onClick={() => onRespond("rejected")}>
        拒绝交换
      </button>
    </>
  );
}
