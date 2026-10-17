"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export const CHAT_COMMAND_CLASS =
  "pressable inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-border px-3 py-2 text-body hover:border-brand disabled:cursor-default disabled:opacity-60";

export function ChatDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useId();
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
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // Round 19: on phones it comes up from the bottom like a BottomSheet; from 768 px a centred panel.
      className="type-app m-auto max-h-[85dvh] w-[min(34rem,calc(100vw_-_2rem))] animate-pop-in overflow-y-auto rounded-card bg-surface p-0 pb-[env(safe-area-inset-bottom)] text-foreground shadow-pop backdrop:animate-fade-in backdrop:bg-black/40 max-md:mb-0 max-md:w-full max-md:max-w-none max-md:animate-sheet-up max-md:rounded-b-none"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 id={heading} className="text-subtitle font-semibold">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭弹窗"
          title="关闭"
          className="pressable flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-background"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>
      <div className="space-y-4 p-4">{children}</div>
    </dialog>
  );
}
