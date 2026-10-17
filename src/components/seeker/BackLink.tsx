"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { lastListHref } from "@/components/seeker/last-list";
import { BACK } from "@/components/ui/PageTransition";

/** Back to the list the user last looked at in this tab, with its filters, or to /jobs. */
export function BackLink() {
  const router = useRouter();
  return (
    <Link
      href="/jobs"
      transitionTypes={BACK}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        router.push(lastListHref(), { transitionTypes: BACK });
      }}
      className="inline-flex items-center gap-1 py-1 text-sm text-muted hover:text-brand"
    >
      <span aria-hidden="true">←</span> 职位列表
    </Link>
  );
}
