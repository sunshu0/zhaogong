"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { firstRoundLength, type ReplayMessage } from "@/components/seeker/chat-replay";
import { useMessages } from "@/i18n/client";
import { seekerHomeMessages } from "@/i18n/messages/seeker-home";

/** Animate only with scripting on and no request for less motion. */
const CAN_ANIMATE = "(scripting: enabled) and (prefers-reduced-motion: no-preference)";
/**
 * The whole conversation is in the HTML (for no JavaScript and reduced motion). Where the replay will run, all but
 * the first round is out of sight until it takes over, so the window starts with that round instead of a blank box.
 * Out of sight only: screen readers have the whole conversation from the start (UI review 2).
 */
const HIDDEN_UNTIL_REPLAY = "[@media(scripting:enabled)_and_(prefers-reduced-motion:no-preference)]:sr-only";

const TYPING_MS = 500;
const READ_MS = 600;

const noop = () => () => {};

/**
 * A replay of a real AI chat post (see chat-replay.ts): messages appear one at a time once the window is about
 * 30% in view, the assistant "typing" first; the ones still to come are there for screen readers all along. With
 * reduced motion or without JavaScript the whole conversation shows at once.
 */
export function ChatReplay({ messages }: { messages: ReplayMessage[] }) {
  const t = useMessages(seekerHomeMessages).replay;
  const root = useRef<HTMLDivElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const canAnimate = useSyncExternalStore(
    noop,
    () => window.matchMedia(CAN_ANIMATE).matches && "IntersectionObserver" in window,
    () => false,
  );
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const firstRound = firstRoundLength(messages);
  // How many messages are shown (the first round from the start), whether the assistant is "typing", and which
  // run of the replay this is.
  const [shown, setShown] = useState(firstRound);
  const [typing, setTyping] = useState(false);
  const [run, setRun] = useState(0);
  const [started, setStarted] = useState(false);
  // 全部显示 (WCAG 2.2.2, UI audit 2): the rest at once, the timers stopped.
  const [skipped, setSkipped] = useState(false);
  // Once the user is in the window (it took focus), the replay no longer scrolls it to the newest message.
  const held = useRef(false);

  // Start once the window is about 30% in view.
  useEffect(() => {
    const el = root.current;
    if (!canAnimate || !el || started) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.intersectionRatio >= 0.3)) return;
        observer.disconnect();
        setStarted(true);
      },
      { threshold: [0, 0.3, 1] },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [canAnimate, started]);

  // The page can render again with an equal but new array (a Server Function call refreshes it); the replay
  // restarts only when the conversation itself changes.
  const script = messages.map((m) => m.id).join("|");
  const latest = useRef(messages);
  useEffect(() => {
    latest.current = messages;
  });

  // Play: each message after a pause, the assistant's after a short "typing".
  useEffect(() => {
    if (!canAnimate || !started || skipped) return;
    const messages = latest.current;
    const timers: number[] = [];
    let at = 300;
    messages.forEach((m, i) => {
      if (i < firstRound) return; // already on screen
      if (m.from === "assistant") {
        timers.push(window.setTimeout(() => setTyping(true), at));
        at += TYPING_MS;
      }
      timers.push(
        window.setTimeout(() => {
          setTyping(false);
          setShown(i + 1);
        }, at),
      );
      at += READ_MS + Math.min(m.text.length * 8, 600);
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [canAnimate, started, skipped, run, script, firstRound]);

  // Keep the newest message in view inside the window (not the page).
  useEffect(() => {
    const el = log.current;
    if (el && !held.current) el.scrollTop = el.scrollHeight;
  }, [shown, typing]);

  const done = !canAnimate || shown === messages.length;

  return (
    <div ref={root} className="overflow-hidden rounded-card bg-background ring-1 ring-border">
      <div className="flex items-center justify-between gap-3 bg-surface px-4 py-2.5 shadow-[0_1px_0_var(--border)]">
        <p className="text-body font-medium">{t.assistant}</p>
        <span className="rounded-full bg-brand-soft px-2 py-0.5 text-meta text-brand">{t.tag}</span>
      </div>

      {/* The window scrolls, so it takes focus for the keyboard (UI review 2). Screen readers read the whole
          conversation in it once, each message after who said it; the messages still to come are out of sight. */}
      <div
        ref={log}
        role="region"
        aria-label={t.log}
        tabIndex={0}
        onFocus={() => {
          held.current = true;
        }}
        data-replay-log=""
        className="relative h-[26rem] space-y-3 overflow-y-auto px-3 py-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
      >
        {messages.map((m, i) => (
          <div
            key={m.id}
            data-bubble=""
            data-pending={canAnimate && i >= shown ? "" : undefined}
            className={`flex ${m.from === "employer" ? "justify-end" : "justify-start"} ${
              canAnimate && i >= shown ? "sr-only" : !hydrated && i >= firstRound ? HIDDEN_UNTIL_REPLAY : ""
            }`}
          >
            <div className="max-w-[85%]">
              <span className="sr-only">{m.from === "assistant" ? t.fromAssistant : t.fromEmployer}</span>
              {/* The conversation itself stays Chinese: AI posting is Chinese in the first round (Round 20). */}
              <p
                lang="zh-CN"
                className={`rounded-card px-3.5 py-2.5 text-body leading-relaxed whitespace-pre-line ${
                  m.from === "employer"
                    ? "rounded-br-sm bg-brand text-white"
                    : "rounded-bl-sm bg-surface ring-1 ring-border"
                }`}
              >
                {m.text}
              </p>
              {m.quickReplies.length > 0 && (
                // Shortened chips the transcript does without, as before.
                <p aria-hidden="true" lang="zh-CN" className="mt-1.5 flex flex-wrap gap-1.5">
                  {m.quickReplies.map((label) => (
                    <span key={label} className="rounded-full bg-brand-soft px-2.5 py-0.5 text-meta text-brand">
                      {label.length > 14 ? `${label.slice(0, 14)}…` : label}
                    </span>
                  ))}
                </p>
              )}
            </div>
          </div>
        ))}
        {typing && (
          <div aria-hidden="true" className="flex justify-start">
            <p className="flex gap-1 rounded-card rounded-bl-sm bg-surface px-3.5 py-3 ring-1 ring-border">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="size-1.5 animate-bounce rounded-full bg-muted"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </p>
          </div>
        )}
      </div>

      {/* One button that keeps the focus: 全部显示 while it plays, 重新播放 once it has played. */}
      {canAnimate && (
        <div className="border-t border-border bg-surface px-3 text-right">
          <button
            type="button"
            onClick={() => {
              setTyping(false);
              if (!done) {
                setSkipped(true);
                setShown(messages.length);
                return;
              }
              held.current = false;
              setSkipped(false);
              setShown(firstRound);
              setRun((r) => r + 1);
            }}
            className="inline-flex min-h-11 items-center px-1 text-body text-brand underline underline-offset-2 hover:text-brand-strong"
          >
            {done ? t.again : t.showAll}
          </button>
        </div>
      )}
    </div>
  );
}
