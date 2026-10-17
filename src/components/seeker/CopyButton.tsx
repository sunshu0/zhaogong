"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui/Button";

/**
 * The Clipboard API needs a secure, focused page; plain http on a phone (testing over the LAN) and some
 * in-app browsers do not have it, so fall back to selecting a hidden textarea and execCommand("copy").
 */
async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the older way.
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

/** Round 19 (#174): both sizes are the secondary Button now, 44px high; `sm` stays for the callers that pass it. */
const SIZES = { sm: "", md: "" };

export function CopyButton({
  text,
  label = "复制",
  size = "sm",
  className = "",
}: {
  text: string;
  label?: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    setState((await writeClipboard(text)) ? "copied" : "failed");
    setTimeout(() => setState("idle"), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`${buttonClass("secondary")} whitespace-nowrap ${SIZES[size]} ${className}`.trim()}
    >
      <span aria-live="polite">{state === "copied" ? "已复制" : state === "failed" ? "复制失败" : label}</span>
    </button>
  );
}
