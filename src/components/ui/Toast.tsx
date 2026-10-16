"use client";

import { useEffect, useSyncExternalStore } from "react";
import { addToast, liveToasts, nextExpiry, type ToastItem } from "@/components/ui/toast-queue";

// Toasts (Round 19): a short line at the bottom of the screen after 收藏, 发送 or 保存, gone after a few seconds.
// Call toast("已收藏") from any client component; the Toaster in the root layout shows them.

let queue: ToastItem[] = [];
let lastId = 0;
const listeners = new Set<() => void>();

function set(next: ToastItem[]) {
  queue = next;
  for (const listener of listeners) listener();
}

export function toast(text: string, ms?: number): void {
  set(addToast(liveToasts(queue, Date.now()), text, ++lastId, Date.now(), ms));
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const EMPTY: ToastItem[] = [];

/**
 * Where toasts show: above the phone's bottom bar, centred. One polite live region (aria-live, not role="status",
 * so pages keep their own status messages unambiguous) reads each new toast to screen readers.
 */
export function Toaster() {
  const items = useSyncExternalStore(
    subscribe,
    () => queue,
    () => EMPTY,
  );

  useEffect(() => {
    const next = nextExpiry(items);
    if (next === null) return;
    const timer = setTimeout(() => set(liveToasts(queue, Date.now())), Math.max(0, next - Date.now()));
    return () => clearTimeout(timer);
  }, [items]);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-above-nav z-40 flex flex-col items-center gap-2 px-4 pb-4"
    >
      {items.map((item) => (
        <p
          key={item.id}
          className="pointer-events-auto max-w-sm animate-toast-in rounded-full bg-foreground/90 px-4 py-2.5 text-center text-body text-white shadow-pop backdrop-blur"
        >
          {item.text}
        </p>
      ))}
    </div>
  );
}
