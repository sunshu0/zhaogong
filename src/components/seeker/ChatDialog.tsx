"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { sheetFromBottom, useKeyboardRoom, useSheetDrag } from "@/components/ui/use-sheet";
import { useMessages } from "@/i18n/client";
import { uiMessages } from "@/i18n/messages/ui";

export const CHAT_COMMAND_CLASS =
  "pressable inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-border px-3 py-2 text-body hover:border-brand disabled:cursor-default disabled:opacity-60";

/**
 * A modal panel for the chat's tools (分享, 举报, 常用语, 发简历, 交换联系方式). From 768 px a centred panel; on a
 * phone a bottom sheet (#413, like BottomSheet): it comes up from the bottom, drags down by its top to close, closes
 * on a tap on the dimmed page, and sits above the keyboard. Esc and 关闭 close it everywhere.
 */
export function ChatDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const t = useMessages(uiMessages);
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const { handlers, style: dragStyle } = useSheetDrag(onClose, sheetFromBottom);
  const keyboard = useKeyboardRoom(true);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={heading}
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // A click on the dialog itself, not on its panel, is a tap on the dimmed page: on a phone it closes.
      onClick={(event) => {
        if (event.target === event.currentTarget && sheetFromBottom()) onClose();
      }}
      style={keyboard || dragStyle ? { ...keyboard, ...dragStyle } : undefined}
      // Round 19: on phones it comes up from the bottom like a BottomSheet; from 768 px a centred panel.
      className="type-app m-auto max-h-[85dvh] w-[min(34rem,calc(100vw_-_2rem))] animate-pop-in overflow-y-auto rounded-card bg-surface p-0 pb-[env(safe-area-inset-bottom)] text-foreground shadow-pop backdrop:animate-fade-in backdrop:bg-black/40 max-md:mb-0 max-md:w-full max-md:max-w-none max-md:animate-sheet-up max-md:overflow-hidden max-md:rounded-b-none max-md:transition-transform max-md:duration-(--duration-ui) max-md:ease-(--ease-app)"
    >
      <div className="max-md:flex max-md:max-h-[inherit] max-md:flex-col">
        <div
          {...handlers}
          className="max-md:shrink-0 max-md:cursor-grab max-md:touch-none max-md:select-none max-md:active:cursor-grabbing"
        >
          <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 rounded-full bg-border md:hidden" />
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <h2 id={heading} className="text-subtitle font-semibold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={t.closeDialog}
              title={t.close}
              className="pressable flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-background"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>
        </div>
        <div className="space-y-4 p-4 max-md:min-h-0 max-md:overflow-y-auto max-md:overscroll-contain">{children}</div>
      </div>
    </dialog>
  );
}
