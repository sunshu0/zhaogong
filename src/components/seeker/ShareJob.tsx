"use client";

import { useState, useSyncExternalStore } from "react";
import { Share2 } from "lucide-react";
import { ChatDialog } from "@/components/seeker/ChatDialog";
import { CopyButton } from "@/components/seeker/CopyButton";
import { isWeChat, withLink } from "@/components/seeker/share";
import { useMessages } from "@/i18n/client";
import { seekerJobsMessages } from "@/i18n/messages/seeker-jobs";

const noop = () => () => {};

/** A browser fact that is only known after hydration; `fallback` during server rendering. */
function useBrowserValue<T>(read: () => T, fallback: T): T {
  return useSyncExternalStore(noop, read, () => fallback);
}

type ShareProps = { path: string; title: string; summary: string };

/** 分享: an icon button that opens the share panel in a dialog. */
export function ShareJobButton(props: ShareProps) {
  const t = useMessages(seekerJobsMessages).share;
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={t.label}
        title={t.title}
        onClick={() => setOpen(true)}
        className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-background hover:text-brand"
      >
        <Share2 aria-hidden="true" className="size-5" />
      </button>
      {open && (
        <ChatDialog title={t.title} onClose={() => setOpen(false)}>
          <SharePanel {...props} />
        </ChatDialog>
      )}
    </>
  );
}

/** Share sheet where the browser has one, copy link, and a short text block to paste into groups. */
function SharePanel({ path, title, summary }: ShareProps) {
  const t = useMessages(seekerJobsMessages).share;
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
      {inWeChat && <p className="text-sm text-muted">{t.inWeChat}</p>}

      <div className="mt-3 flex gap-2 first:mt-0">
        {canShare && (
          <button
            type="button"
            onClick={share}
            className="flex-1 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white"
          >
            {t.more}
          </button>
        )}
        <CopyButton text={url} label={t.copyLink} size="md" className="flex-1" />
      </div>

      <div className="mt-3 rounded-lg bg-background p-3">
        {/* The text for WeChat groups stays Chinese (like the employer's share texts). */}
        <p lang="zh-CN" className="text-sm break-all whitespace-pre-line">
          {text}
        </p>
        <CopyButton text={text} label={t.copyText} className="mt-2" />
      </div>
    </div>
  );
}
