"use client";

import { useState, useSyncExternalStore } from "react";
import { Share2 } from "lucide-react";
import { ChatDialog } from "@/components/seeker/ChatDialog";
import { CopyButton } from "@/components/seeker/CopyButton";
import { isWeChat, withLink } from "@/components/seeker/share";

const noop = () => () => {};

/** A browser fact that is only known after hydration; `fallback` during server rendering. */
function useBrowserValue<T>(read: () => T, fallback: T): T {
  return useSyncExternalStore(noop, read, () => fallback);
}

type ShareProps = { path: string; title: string; summary: string };

/** 分享: an icon button that opens the share panel in a dialog. */
export function ShareJobButton(props: ShareProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="分享"
        title="分享给朋友"
        onClick={() => setOpen(true)}
        className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-background hover:text-brand"
      >
        <Share2 aria-hidden="true" className="size-5" />
      </button>
      {open && (
        <ChatDialog title="分享给朋友" onClose={() => setOpen(false)}>
          <SharePanel {...props} />
        </ChatDialog>
      )}
    </>
  );
}

/** Share sheet where the browser has one, copy link, and a short text block to paste into groups. */
function SharePanel({ path, title, summary }: ShareProps) {
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
    <div>
      {inWeChat && <p className="text-sm text-muted">点右上角「···」，可以发送给朋友或分享到朋友圈。</p>}

      <div className="mt-3 flex gap-2 first:mt-0">
        {canShare && (
          <button
            type="button"
            onClick={share}
            className="flex-1 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white"
          >
            分享…
          </button>
        )}
        <CopyButton text={url} label="复制链接" size="md" className="flex-1" />
      </div>

      <div className="mt-3 rounded-lg bg-background p-3">
        <p className="text-sm break-all whitespace-pre-line">{text}</p>
        <CopyButton text={text} label="复制这段文字" className="mt-2" />
      </div>
    </div>
  );
}
