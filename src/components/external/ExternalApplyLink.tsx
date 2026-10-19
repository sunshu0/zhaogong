"use client";

import type { ReactNode } from "react";
import { track } from "@/lib/events/track";

/**
 * 去官网申请 on a real external job: the company's posting in a new window, and the funnel's last step
 * (external_apply_click, #314, ADR 0025 §4) on the way out.
 */
export function ExternalApplyLink({
  href,
  jobId,
  className,
  children,
}: {
  href: string;
  jobId: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={() => track({ name: "external_apply_click", path: "/external/[id]", jobId })}
    >
      {children}
    </a>
  );
}
