"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const subscribe = (onChange: () => void) => {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
};

/**
 * The site header (Round 19, an app's feel): stuck to the top, see-through with the page blurred behind it, and a
 * faint line under it only once the page has scrolled. Before JavaScript runs it keeps the line.
 */
export function StickyHeader({ children }: { children: ReactNode }) {
  const scrolled = useSyncExternalStore(
    subscribe,
    () => window.scrollY > 4,
    () => true,
  );
  return (
    <header
      data-scrolled={scrolled || undefined}
      className="sticky top-0 z-20 border-b border-transparent bg-surface/80 backdrop-blur-md backdrop-saturate-150 transition-colors duration-(--duration-ui) data-scrolled:border-border/70"
    >
      {children}
    </header>
  );
}
