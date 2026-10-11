"use client";

import { useState } from "react";

export function CopyButton({ text, label = "复制", className = "" }: { text: string; label?: string; className?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`rounded-md border border-border px-2 py-1 text-xs hover:border-brand hover:text-brand ${className}`}
    >
      <span aria-live="polite">{state === "copied" ? "已复制" : state === "failed" ? "复制失败" : label}</span>
    </button>
  );
}
