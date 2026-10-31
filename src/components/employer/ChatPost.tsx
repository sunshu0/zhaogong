"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import type { ChatState } from "@/lib/ai-post";
import type { CountryCode } from "@/lib/types";
import { chatAssistantKind, chatTurn } from "@/app/[lang]/employer/actions";
import type { AssistantKind } from "@/lib/ai-post/model";
import { DraftCard } from "@/components/employer/DraftCard";
import { WIDE_ON_DESKTOP } from "@/components/ui/wide";
import { Button } from "@/components/ui/Button";
import { fieldBorder } from "@/components/ui/input-class";
import { useMessages } from "@/i18n/client";
import { contentLang } from "@/i18n/lang";
import { employerPostMessages } from "@/i18n/messages/employer-post";

/**
 * Posting by conversation: the assistant asks one thing at a time, quick replies are buttons, and
 * the job card beside the chat (below it on a phone) fills as the answers come in.
 */
export function ChatPost({
  chat,
  setChat,
  country,
  headingRef,
  onPreview,
  onUseForm,
}: {
  chat: ChatState;
  setChat: (s: ChatState) => void;
  country: CountryCode;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onPreview: (s: ChatState) => void;
  onUseForm: () => void;
}) {
  const t = useMessages(employerPostMessages).chat;
  const [text, setText] = useState("");
  const [sending, setSending] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  // #102: who answers. Outside production it may be the rule-based script, and the page says so.
  const [kind, setKind] = useState<AssistantKind>();
  useEffect(() => {
    chatAssistantKind().then(setKind, () => undefined);
  }, []);
  const unavailable = kind === "unavailable" || chat.unavailable;
  const input = useRef<HTMLTextAreaElement>(null);
  const lastMessage = useRef<HTMLLIElement>(null);
  const last = chat.messages[chat.messages.length - 1];
  const replies = last?.from === "assistant" ? (last.quickReplies ?? []) : [];

  useEffect(() => {
    lastMessage.current?.scrollIntoView({ block: "nearest" });
  }, [chat.messages.length, sending]);

  function send(message: string) {
    const m = message.trim();
    if (!m || pending) return;
    setError(undefined);
    setSending(m);
    setText("");
    // #202: 发送 is disabled once the box is empty; a press on it would drop the focus to the page.
    input.current?.focus();
    startTransition(async () => {
      try {
        const next = await chatTurn(chat, m);
        setChat(next);
        if (next.ready) onPreview(next);
      } catch {
        setText(m);
        setError(t.sendFailed);
      } finally {
        setSending(undefined);
        input.current?.focus();
      }
    });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(text);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter is a new line; never while an input method is still composing (拼音).
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(text);
    }
  }

  return (
    <div className={WIDE_ON_DESKTOP}>
      <div className="gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="chat-heading" className="flex flex-col">
          <h1 id="chat-heading" ref={headingRef} tabIndex={-1} className="mb-3 text-title font-semibold outline-none">
            {t.heading}
          </h1>
          {kind === "script" && <p className="-mt-2 mb-3 text-meta text-muted">{t.scriptAssistant}</p>}
          {/* #342: before anything leaves for the model (the browser tests' fake stands in for it); never for the
              script, which sends nothing. */}
          {(kind === "claude" || kind === "fake") && (
            <p className="-mt-2 mb-3 text-meta text-muted">
              {t.sentAbroad}{" "}
              <Link href="/privacy#share" className="text-brand underline underline-offset-4">
                {t.sentAbroadPrivacy}
              </Link>
              {" · "}
              <button type="button" onClick={onUseForm} className="text-brand underline underline-offset-4">
                {t.sentAbroadForm}
              </button>
            </p>
          )}
          {/* The live region is the wrapper, so the list keeps its list semantics. */}
          {/* As tall as the conversation: no empty block before the first answers. */}
          <div role="log" aria-live="polite" aria-label={t.logLabel}>
            <ol className="space-y-3">
              {chat.messages.map((m, i) => (
                <li
                  key={m.id}
                  ref={i === chat.messages.length - 1 && !sending ? lastMessage : undefined}
                  className={m.from === "assistant" ? "mr-8" : "ml-8 flex justify-end"}
                >
                  <p
                    className={`animate-pop-in rounded-card px-3.5 py-2.5 text-body leading-relaxed whitespace-pre-line ${
                      m.from === "assistant"
                        ? "rounded-tl-sm bg-surface ring-1 ring-border"
                        : "rounded-tr-sm bg-brand text-white"
                    }`}
                  >
                    <span className="sr-only">{m.from === "assistant" ? t.fromAssistant : t.fromYou}</span>
                    {/* What the employer typed is theirs; the assistant answers in Chinese whatever the page's
                        language is (phase 1), so both sides say which language they are in. */}
                    <span lang={contentLang(m.text)}>{m.text}</span>
                  </p>
                </li>
              ))}
              {/* The key the sent message gets once the answer is back (withMessage: m<count + 1>), so that
                  answer turns this bubble into the message in place: role=log does not get the same words twice. */}
              {sending && (
                <li key={`m${chat.messages.length + 1}`} ref={lastMessage} className="ml-8 flex justify-end">
                  <p className="rounded-card rounded-tr-sm bg-brand/80 px-3.5 py-2.5 text-body whitespace-pre-line text-white">
                    <span className="sr-only">{t.fromYou}</span>
                    <span lang={contentLang(sending)}>{sending}</span>
                  </p>
                </li>
              )}
            </ol>
          </div>
          {pending && (
            <p aria-hidden="true" className="mt-2 text-meta text-muted">
              {t.thinking}
            </p>
          )}

          <div className="sticky bottom-0 -mx-4 mt-3 space-y-2 bg-background/90 px-4 py-3 shadow-[0_-1px_0_var(--border)] backdrop-blur-md lg:mx-0 lg:px-0">
            {replies.length > 0 && !pending && (
              <div role="group" aria-label={t.quickRepliesLabel} className="flex flex-wrap gap-2">
                {replies.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => send(q.value ?? q.label)}
                    className="pressable min-h-11 rounded-full bg-surface px-4 text-body text-brand shadow-card hover:bg-brand-soft"
                  >
                    {/* The assistant writes its quick replies in Chinese too (lib/ai-post). */}
                    <span lang={contentLang(q.label)}>{q.label}</span>
                  </button>
                ))}
              </div>
            )}
            {unavailable && !pending && (
              <p className="rounded-control bg-warn-soft px-3 py-2 text-body text-warn">
                {t.unavailable}
                <button
                  type="button"
                  onClick={onUseForm}
                  className="ml-1 font-medium text-brand underline underline-offset-4"
                >
                  {t.useFormInstead}
                </button>
              </p>
            )}
            {error && (
              <p role="alert" className="text-body text-danger">
                {error}
              </p>
            )}
            <form onSubmit={onSubmit} className="flex items-end gap-2">
              <label htmlFor="chat-input" className="sr-only">
                {t.inputLabel}
              </label>
              <textarea
                id="chat-input"
                ref={input}
                rows={2}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={t.inputPlaceholder}
                // inputClass() but two rows high: its multiline box is 96 px, too tall under a conversation.
                className={`min-h-11 flex-1 resize-y rounded-control border bg-surface px-3 py-2 text-base outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/30 ${fieldBorder()}`}
              />
              <Button type="submit" loading={pending} disabled={!text.trim()}>
                {t.send}
              </Button>
            </form>
            <button type="button" onClick={onUseForm} className="pressable min-h-11 text-meta text-muted underline">
              {t.editInForm}
            </button>
          </div>
        </section>

        <aside className="mt-6 lg:mt-0">
          <div className="lg:sticky lg:top-18">
            <DraftCard
              draft={chat.draft}
              country={country}
              employer={chat.employer}
              canAsk={(item) => !pending && canAskAbout(chat.asking, item.ask)}
              onAsk={send}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

/**
 * A card item sends 「改一下…」, which the chat takes anywhere except while it reads a whole post or a
 * rewrite; 公开联系方式 is an answer to the review question only.
 */
function canAskAbout(asking: ChatState["asking"], ask: string): boolean {
  if (asking === "description" || asking === "rewrite" || asking === "fix") return false;
  return ask !== "公开联系方式" || asking === "review";
}
