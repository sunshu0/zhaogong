"use client";
import { useEffect, useRef, useState, useTransition, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import type { ChatState } from "@/lib/ai-post";
import type { CountryCode } from "@/lib/types";
import { chatAssistantKind, chatTurn } from "@/app/employer/actions";
import type { AssistantKind } from "@/lib/ai-post/model";
import { DraftCard } from "@/components/employer/DraftCard";
import { WIDE_ON_DESKTOP } from "@/components/ui/wide";
import { buttonClass } from "@/components/ui/Button";

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
    startTransition(async () => {
      try {
        const next = await chatTurn(chat, m);
        setChat(next);
        if (next.ready) onPreview(next);
      } catch {
        setText(m);
        setError("没发出去，请再试一次。");
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
            和发帖助手一起写招聘
          </h1>
          {kind === "script" && <p className="-mt-2 mb-3 text-meta text-muted">开发环境：脚本助手，不是 AI。</p>}
          {/* The live region is the wrapper, so the list keeps its list semantics. */}
          {/* As tall as the conversation: no empty block before the first answers. */}
          <div role="log" aria-live="polite" aria-label="和发帖助手的对话">
            <ol className="space-y-3">
              {chat.messages.map((m, i) => (
                <li
                  key={m.id}
                  ref={i === chat.messages.length - 1 && !sending ? lastMessage : undefined}
                  className={m.from === "assistant" ? "mr-8" : "ml-8 flex justify-end"}
                >
                  <p
                    className={`rounded-md px-3 py-2 text-body leading-relaxed whitespace-pre-line ${
                      m.from === "assistant"
                        ? "rounded-tl-sm bg-surface border border-border"
                        : "rounded-tr-sm bg-brand text-white"
                    }`}
                  >
                    <span className="sr-only">{m.from === "assistant" ? "助手：" : "你："}</span>
                    {m.text}
                  </p>
                </li>
              ))}
              {sending && (
                <li ref={lastMessage} className="ml-8 flex justify-end">
                  <p className="rounded-md bg-brand/80 px-3 py-2 text-body whitespace-pre-line text-white">
                    <span className="sr-only">你：</span>
                    {sending}
                  </p>
                </li>
              )}
            </ol>
          </div>
          {pending && (
            <p aria-hidden="true" className="mt-2 text-meta text-muted">
              助手正在整理…
            </p>
          )}

          <div className="sticky bottom-0 -mx-4 mt-3 space-y-2 border-t border-border bg-background px-4 py-3 lg:mx-0 lg:px-0">
            {replies.length > 0 && !pending && (
              <div role="group" aria-label="快捷回复" className="flex flex-wrap gap-2">
                {replies.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => send(q.value ?? q.label)}
                    className="h-9 rounded-md border border-brand/35 bg-surface px-3 text-body text-brand hover:bg-brand-soft"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            )}
            {unavailable && !pending && (
              <p className="rounded-md bg-warn-soft px-3 py-2 text-body text-warn">
                AI 发帖助手暂时不可用。
                <button
                  type="button"
                  onClick={onUseForm}
                  className="ml-1 font-medium text-brand underline underline-offset-4"
                >
                  改用直接填表
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
                回复助手
              </label>
              <textarea
                id="chat-input"
                ref={input}
                rows={2}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="输入回复，回车发送（Shift + 回车换行）"
                className="min-h-11 flex-1 resize-y rounded-md border border-border bg-surface px-3 py-2 text-body"
              />
              <button type="submit" disabled={pending || !text.trim()} className={buttonClass("primary")}>
                发送
              </button>
            </form>
            <button type="button" onClick={onUseForm} className="text-meta text-muted underline">
              在表单里改
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
