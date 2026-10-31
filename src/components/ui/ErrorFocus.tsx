"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Around an error page's StatusCard (#161, #178): the page that had the focus is gone, so the focus would drop to the
 * body. It comes here instead, so a keyboard user is one Tab away from 重试, and the card inside is an alert, so a
 * screen reader says the page failed (UI review 3, C7). The focus and the alert are on two elements, so a screen
 * reader is less likely to read it twice. Nothing changes on the screen.
 */
export function ErrorFocus({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div ref={ref} tabIndex={-1} className="outline-none">
      <div role="alert">{children}</div>
    </div>
  );
}
