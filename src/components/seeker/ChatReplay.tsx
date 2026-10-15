"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { firstRoundLength, type ReplayMessage } from "@/components/seeker/chat-replay";

/** Animate only with scripting on and no request for less motion. */
const CAN_ANIMATE = "(scripting: enabled) and (prefers-reduced-motion: no-preference)";
/**
 * The whole conversation is in the HTML (for no JavaScript and reduced motion). Where the replay will run, all but
 * the first round is hidden until it takes over, so the window starts with that round instead of a blank box.
 */
const HIDDEN_UNTIL_REPLAY = "[@media(scripting:enabled)_and_(prefers-reduced-motion:no-preference)]:hidden";

const TYPING_MS = 500;
const READ_MS = 600;

const noop = () => () => {};

/**
 * A replay of a real AI chat post (see chat-replay.ts): messages appear one at a time once the window is about
 * 30% in view, the assistant "typing" first. Screen readers get the whole conversation as a list; with reduced
 * motion or without JavaScript the whole conversation shows at once.
 */
export function ChatReplay({ messages }: { messages: ReplayMessage[] }) {
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
    if (!canAnimate || !started) return;
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
  }, [canAnimate, started, run, script, firstRound]);

  // Keep the newest message in view inside the window (not the page).
  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown, typing]);

  const visible = canAnimate ? messages.slice(0, shown) : messages;
  const done = !canAnimate || shown === messages.length;

  return (
    <div ref={root} className="overflow-hidden rounded-md border border-border bg-background">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2.5">
        <p className="text-sm font-medium">找工发帖助手</p>
        <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand">真实对话回放</span>
      </div>

      <ol className="sr-only">
        {messages.map((m) => (
          <li key={m.id}>
            {m.from === "assistant" ? "助手：" : "雇主："}
            {m.text}
          </li>
        ))}
      </ol>

      <div ref={log} aria-hidden="true" data-replay-log="" className="h-[26rem] space-y-3 overflow-y-auto px-3 py-4">
        {visible.map((m, i) => (
          <div
            key={m.id}
            data-bubble=""
            className={`flex ${m.from === "employer" ? "justify-end" : "justify-start"} ${
              !hydrated && i >= firstRound ? HIDDEN_UNTIL_REPLAY : ""
            }`}
          >
            <div className="max-w-[85%]">
              <p
                className={`rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-line ${
                  m.from === "employer"
                    ? "rounded-br-sm bg-brand text-white"
                    : "rounded-bl-sm border border-border bg-surface"
                }`}
              >
                {m.text}
              </p>
              {m.quickReplies.length > 0 && (
                <p className="mt-1.5 flex flex-wrap gap-1.5">
                  {m.quickReplies.map((label) => (
                    <span
                      key={label}
                      className="rounded-full border border-brand/40 bg-surface px-2 py-0.5 text-xs text-brand"
                    >
                      {label.length > 14 ? `${label.slice(0, 14)}…` : label}
                    </span>
                  ))}
                </p>
              )}
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex justify-start">
            <p className="flex gap-1 rounded-2xl rounded-bl-sm border border-border bg-surface px-3 py-3">
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

      {canAnimate && done && (
        <div className="border-t border-border bg-surface px-4 py-2 text-right">
          <button
            type="button"
            onClick={() => {
              setShown(firstRound);
              setTyping(false);
              setRun((r) => r + 1);
            }}
            className="text-sm text-brand underline underline-offset-2"
          >
            重新播放
          </button>
        </div>
      )}
    </div>
  );
}
