"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { shouldDismiss } from "@/components/ui/sheet-drag";
import { useMessages } from "@/i18n/client";
import { uiMessages } from "@/i18n/messages/ui";

/**
 * A bottom sheet (Round 19, an app's feel): on a phone a panel slides up from the bottom; from 768 px it is a centred
 * panel. A modal <dialog>, so focus stays inside and the page behind is inert. Closes on the 关闭 button, Esc, a
 * tap on the dimmed page, or by dragging the handle down. Shown while `open`; the parent owns that state and closes
 * it in `onClose`. A `footer` (the sheet's buttons) stays below the scrolling content, never over it.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const closeLabel = useMessages(uiMessages).close;
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const drag = useRef<{ startY: number; startAt: number } | null>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    // The content can name what takes the focus first (Select's option list); otherwise the dialog decides.
    dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => {
      dialog.close();
      setOffset(0);
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);

  if (!open) return null;

  const dragHandlers = {
    onPointerDown: (event: PointerEvent) => {
      if ((event.target as HTMLElement).closest("button")) return; // 关闭 stays a plain button
      drag.current = { startY: event.clientY, startAt: event.timeStamp };
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: PointerEvent) => {
      if (drag.current) setOffset(Math.max(0, event.clientY - drag.current.startY));
    },
    onPointerUp: (event: PointerEvent) => {
      const start = drag.current;
      drag.current = null;
      if (!start) return;
      const distance = event.clientY - start.startY;
      if (shouldDismiss(distance, event.timeStamp - start.startAt)) onClose();
      else setOffset(0);
    },
    onPointerCancel: () => {
      drag.current = null;
      setOffset(0);
    },
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={heading}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // A click on the dialog itself, not on its panel, is a tap on the dimmed page around it.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={offset ? { transform: `translateY(${offset}px)`, transition: "none" } : undefined}
      className="mx-0 mt-auto mb-0 max-h-[85dvh] w-full max-w-none animate-sheet-up overflow-hidden rounded-t-card bg-surface p-0 pb-[env(safe-area-inset-bottom)] text-foreground shadow-pop transition-transform duration-(--duration-ui) ease-(--ease-app) backdrop:animate-fade-in backdrop:bg-black/40 md:m-auto md:w-[min(28rem,calc(100vw_-_2rem))] md:animate-pop-in md:rounded-card md:pb-0"
    >
      <div className="flex max-h-[85dvh] flex-col">
        <div
          {...dragHandlers}
          className="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing md:cursor-auto"
        >
          <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 rounded-full bg-border md:hidden" />
          <div className="flex items-center justify-between gap-3 px-4 pt-2 pb-1 md:pt-3">
            <h2 id={heading} className="text-subtitle font-semibold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="pressable -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-background"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-2 pb-3">{children}</div>
        {footer && <div className="shrink-0 border-t border-border px-4 py-3">{footer}</div>}
      </div>
    </dialog>
  );
}
