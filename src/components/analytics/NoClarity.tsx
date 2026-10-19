"use client";

import { useEffect } from "react";
import { NO_CLARITY_FLAG } from "@/components/analytics/flags";

/**
 * Puts it on a page that Clarity must not record but whose path does not say so (#313, ADR 0025 §6): an internship's
 * external job page. Opened directly, Clarity does not load (Analytics reads the flag); reached by a client
 * navigation with Clarity already running, the whole page is masked. The hidden marker comes with the HTML, so the
 * loader sees it even before this page has hydrated.
 */
export function NoClarity() {
  useEffect(() => {
    window[NO_CLARITY_FLAG] = true;
    document.body.setAttribute("data-clarity-mask", "true");
    return () => {
      window[NO_CLARITY_FLAG] = false;
    };
  }, []);
  return <span data-zg-no-clarity="" hidden />;
}
