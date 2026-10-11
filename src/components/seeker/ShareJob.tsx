"use client";

import { useSyncExternalStore } from "react";
import { CopyButton } from "@/components/seeker/CopyButton";
import { isWeChat, withLink } from "@/components/seeker/share";

const noop = () => () => {};

/** A browser fact that is only known after hydration; `fallback` during server rendering. */
function useBrowserValue<T>(read: () => T, fallback: T): T {
  return useSyncExternalStore(noop, read, () => fallback);
}

/** Share sheet where the browser has one, copy link, and a short text block to paste into groups. */
export function ShareJob({ path, title, summary }: { path: string; title: string; summary: string }) {
  const origin = useBrowserValue(() => location.origin, "");
  const canShare = useBrowserValue(() => typeof navigator.share === "function", false);
  const inWeChat = useBrowserValue(() => isWeChat(navigator.userAgent), false);
  const url = `${origin}${path}`;
  const text = withLink(summary, url);

  async function share() {
    try {
      await navigator.share({ title, text: summary, url });
    } catch {
      // The user closed the share sheet; nothing to do.
    }
  }

  return (
    <section aria-labelledby="share-heading" className="rounded-xl border border-border bg-surface p-4">
      <h2 id="share-heading" className="font-medium">
        分享给朋友
      </h2>
      {inWeChat && <p className="mt-1 text-sm text-muted">点右上角「···」，可以发送给朋友或分享到朋友圈。</p>}

      <div className="mt-3 flex gap-2">
        {canShare && (
          <button type="button" onClick={share} className="flex-1 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white">
            分享…
          </button>
        )}
        <CopyButton text={url} label="复制链接" size="md" className="flex-1" />
      </div>

      <div className="mt-3 rounded-lg bg-background p-3">
        <p className="text-sm break-all whitespace-pre-line">{text}</p>
        <CopyButton text={text} label="复制这段文字" className="mt-2" />
      </div>
    </section>
  );
}
