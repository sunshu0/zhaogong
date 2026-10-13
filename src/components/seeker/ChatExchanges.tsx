"use client";

import { Contact, FileText, MapPin } from "lucide-react";
import { useChat } from "@/components/seeker/chat-client";
import { EXCHANGE_LABELS, visibleExchange, type Exchange } from "@/lib/chat-consent";
import { CHAT_COMMAND_CLASS } from "@/components/seeker/ChatDialog";
import { ExchangeAction } from "@/components/seeker/ExchangeAction";
import { PayloadView } from "@/components/seeker/ExchangePayload";

const TOOLS = [
  { kind: "resume" as const, label: "交换资料", icon: FileText },
  { kind: "contact" as const, label: "交换联系方式", icon: Contact },
  { kind: "address" as const, label: "交换地址", icon: MapPin },
];

export function ChatExchangeTools({ conversationId }: { conversationId: string }) {
  const { exchanges } = useChat();
  const items = exchanges[conversationId] ?? [];
  return (
    <div className="mb-3 flex flex-wrap gap-2" aria-label="沟通工具">
      {TOOLS.map((tool) => {
        const { kind } = tool;
        const current = items.find((item) => item.kind === kind && ["pending", "accepted"].includes(item.status));
        return (
          <span key={kind}>
            <ExchangeTool conversationId={conversationId} tool={tool} current={current} />
          </span>
        );
      })}
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
                  {item.from === "me" ? "等待对方同意，双方资料尚未交换。" : "双方同意后才会交换资料，你可以拒绝。"}
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
              <p className="text-muted">{item.from === "me" ? "对方已拒绝" : "你已拒绝"}，双方资料未交换。</p>
            )}
            {item.status === "cancelled" && <p className="text-muted">请求已撤回，双方资料未交换。</p>}
            {visible && (
              <>
                <p className="text-ok">双方已同意，资料已交换。</p>
                <div className="grid gap-4 border-t border-border pt-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <h4 className="font-medium">对方的资料</h4>
                    <PayloadView payload={visible.them} />
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">我的资料</h4>
                    <PayloadView payload={visible.me} />
                  </div>
                </div>
              </>
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
