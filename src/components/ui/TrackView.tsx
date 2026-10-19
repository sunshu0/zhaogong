"use client";

import { useEffect, useRef } from "react";
import type { EventInput } from "@/lib/events/catalog";
import { track } from "@/lib/events/track";

/**
 * Records that a page was shown (#314, ADR 0025 §4): put it anywhere on the page; it renders nothing and sends
 * `event` once when the page mounts. Only names and values on the list are stored (catalog.ts).
 */
export function TrackView({ event }: { event: EventInput }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    track(event);
  }, [event]); // `sent` keeps it to once, even when the parent passes a new object each render
  return null;
}
