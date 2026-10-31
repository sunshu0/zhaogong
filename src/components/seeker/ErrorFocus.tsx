"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Around an error page's StatusCard (#161, #178): the page that had the focus is gone, so the focus would drop to the
 * body. It comes here instead, an alert, so a screen reader says the page failed and a keyboard user is one Tab away
 * from 重试 (UI review 3, C7) — as a failed post's message does (PostFlow). Nothing changes on the screen.
 */
export function ErrorFocus({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div ref={ref} role="alert" tabIndex={-1} className="outline-none">
      {children}
    </div>
  );
}
