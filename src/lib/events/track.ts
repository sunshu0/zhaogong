// The browser's side of the funnel events (#312, ADR 0025 §4): track() sends one event to /api/events and does not
// wait for an answer. Pages call it when they show or when something is pressed; a Server Function that succeeds
// records its own event on the server instead (record.ts). Only names and values on the list are stored.
import type { EventInput } from "@/lib/events/catalog";

/** Sends `event` with sendBeacon (fetch with keepalive where there is none). Never throws. */
export function track(event: EventInput): void {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify(event);
    if (navigator.sendBeacon?.(new URL("/api/events", location.origin), body)) return;
    void fetch("/api/events", { method: "POST", body, keepalive: true }).catch(() => {});
  } catch {
    // Analytics never gets in the way.
  }
}
