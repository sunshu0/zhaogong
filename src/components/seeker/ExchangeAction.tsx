"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useChat } from "@/components/seeker/chat-client";
import { useProfile } from "@/components/seeker/hub-client";
import { useSession } from "@/components/seeker/session-client";
import { EXCHANGE_LABELS, profilePayload, type Exchange, type ExchangeKind } from "@/lib/chat-consent";
import { ChatDialog, CHAT_COMMAND_CLASS } from "@/components/seeker/ChatDialog";
import { PayloadView } from "@/components/seeker/ExchangePayload";

export function ExchangeAction({
  conversationId,
  kind,
  incoming,
  children,
}: {
  conversationId: string;
  kind: ExchangeKind;
  incoming?: Exchange;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { profile } = useProfile();
  const isEmployer = useSession()?.activeRole === "employer";
  const { requestInfo, respondInfo } = useChat();
  const payload = profilePayload(profile, kind, isEmployer);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={CHAT_COMMAND_CLASS}>
        {children}
      </button>
      {open && (
        <ChatDialog
          title={incoming ? `同意交换${EXCHANGE_LABELS[kind]}` : `申请交换${EXCHANGE_LABELS[kind]}`}
          onClose={() => setOpen(false)}
        >
          <p className="text-sm leading-relaxed">
            {incoming
              ? "同意后，你和对方将同时获得彼此本次交换的资料。"
              : "对方同意后，你和对方将同时获得彼此本次交换的资料。"}
          </p>
          <section aria-label="我的交换内容" className="space-y-3 border-y border-border py-4">
            <h3 className="text-sm font-semibold">本次将交换的我的资料</h3>
            {payload ? (
              <PayloadView payload={payload} />
            ) : (
              <p className="text-sm text-muted">尚未填写可交换的{EXCHANGE_LABELS[kind]}。</p>
            )}
            <Link href="/profile" className="inline-flex min-h-11 items-center text-sm text-brand underline">
              编辑我的资料
            </Link>
          </section>
          <p className="text-xs leading-relaxed text-muted">
            同意交换后，对方可能保存这些资料。拒绝或撤回请求不会交换任何资料。
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={CHAT_COMMAND_CLASS} onClick={() => setOpen(false)}>
              取消
            </button>
            <button
              type="button"
              disabled={!payload}
              onClick={() => {
                if (!payload) return;
                if (incoming) respondInfo(conversationId, incoming.id, "accepted", payload);
                else requestInfo(conversationId, kind, payload);
                setOpen(false);
              }}
              className="min-h-11 rounded-lg bg-brand px-4 text-sm font-medium text-white disabled:opacity-50"
            >
              {incoming ? "同意并交换双方资料" : "发送交换请求"}
            </button>
          </div>
        </ChatDialog>
      )}
    </>
  );
}
