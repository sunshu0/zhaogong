"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { keyboardRoom } from "@/components/ui/sheet-keyboard";
import { shouldDismiss } from "@/components/ui/sheet-drag";

/** From here up a sheet is a centred panel (or a dropdown), not a bottom sheet (#413). */
export const PANEL_QUERY = "(min-width: 48rem)";

/** Whether a sheet opened now comes up from the bottom: a phone-sized window. */
export function sheetFromBottom(): boolean {
  return !window.matchMedia(PANEL_QUERY).matches;
}

/**
 * Dragging a bottom sheet down by its top (Round 19; shared with ChatDialog in #413): the sheet follows the finger
 * and closes when let go far or fast enough (`shouldDismiss`), else goes back. `enabled` is asked when a drag starts,
 * so a sheet that is a centred panel on wide windows can say no there. Spread `handlers` on the drag area (a press
 * on a button in it stays a press) and put `style` on the sheet; `reset` puts it back when it closes.
 */
export function useSheetDrag(onClose: () => void, enabled: () => boolean = () => true) {
  const drag = useRef<{ startY: number; startAt: number } | null>(null);
  const [offset, setOffset] = useState(0);
  const handlers = {
    onPointerDown: (event: PointerEvent) => {
      if ((event.target as HTMLElement).closest("button") || !enabled()) return;
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
      if (shouldDismiss(event.clientY - start.startY, event.timeStamp - start.startAt)) onClose();
      else setOffset(0);
    },
    onPointerCancel: () => {
      drag.current = null;
      setOffset(0);
    },
  };
  const style: CSSProperties | undefined = offset
    ? { transform: `translateY(${offset}px)`, transition: "none" }
    : undefined;
  const reset = useCallback(() => setOffset(0), []);
  return { handlers, style, reset };
}

/**
 * Keeps an open bottom sheet above the phone's keyboard where the browser does not shrink the page for it (#413;
 * see `keyboardRoom`): the sheet sits on the keyboard and fits in the visible window, so the field being typed in
 * stays in sight. Returns the style for the sheet; nothing on wide windows or while no keyboard is up.
 */
export function useKeyboardRoom(open: boolean): CSSProperties | undefined {
  const [room, setRoom] = useState<{ inset: number; height: number } | null>(null);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!open || !viewport) return;
    const apply = () => setRoom(sheetFromBottom() ? keyboardRoom(window.innerHeight, viewport) : null);
    apply();
    viewport.addEventListener("resize", apply);
    viewport.addEventListener("scroll", apply);
    return () => {
      viewport.removeEventListener("resize", apply);
      viewport.removeEventListener("scroll", apply);
      setRoom(null);
    };
  }, [open]);
  return room ? { marginBottom: room.inset, maxHeight: `min(85dvh, ${room.height - 8}px)` } : undefined;
}
