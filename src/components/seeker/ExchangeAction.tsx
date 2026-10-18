"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useChat } from "@/components/seeker/chat-client";
import { useProfile } from "@/components/seeker/hub-client";
import { useSession } from "@/components/seeker/session-client";
import { profilePayload, type Exchange, type ExchangeKind } from "@/lib/chat-consent";
import { useLang, useMessages } from "@/i18n/client";
import { chatMessages } from "@/i18n/messages/chat";
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
  const words = useMessages(chatMessages);
  const t = words.exchangeDialog;
  const kindLabel = words.exchangeKinds[kind];
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const { profile } = useProfile();
  const isEmployer = useSession()?.activeRole === "employer";
  const { requestInfo, respondInfo } = useChat();
  const payload = profilePayload(profile, kind, isEmployer, lang);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={CHAT_COMMAND_CLASS}>
        {children}
      </button>
      {open && (
        <ChatDialog title={incoming ? t.agreeTitle(kindLabel) : t.askTitle(kindLabel)} onClose={() => setOpen(false)}>
          <p className="text-sm leading-relaxed">{incoming ? t.agreeNote : t.askNote}</p>
          <section aria-label={t.mineLabel} className="space-y-3 border-y border-border py-4">
            <h3 className="text-sm font-semibold">{incoming ? t.agreeHeading : t.askHeading}</h3>
            {payload ? (
              <PayloadView payload={payload} />
            ) : (
              <p className="text-sm text-muted">
                {t.nothingYet(kindLabel)}
                {incoming ? t.nothingYetAgree : t.nothingYetAsk}
              </p>
            )}
            <Link href="/profile" className="inline-flex min-h-11 items-center text-sm text-brand underline">
              {payload ? t.editMine : t.fillMine(kindLabel)}
            </Link>
          </section>
          <p className="text-xs leading-relaxed text-muted">{t.keepNote}</p>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={CHAT_COMMAND_CLASS} onClick={() => setOpen(false)}>
              {t.cancel}
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
              className="min-h-11 rounded-md bg-brand px-4 text-sm font-medium text-white disabled:opacity-50"
            >
              {incoming ? t.agree : t.ask}
            </button>
          </div>
        </ChatDialog>
      )}
    </>
  );
}
