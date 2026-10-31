"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { lastListHref } from "@/components/seeker/last-list";
import { markReturn, returnTo } from "@/components/seeker/list-place";
import { BACK } from "@/components/ui/PageTransition";
import { useMessages } from "@/i18n/client";
import { seekerJobsMessages } from "@/i18n/messages/seeker-jobs";

/**
 * Back to the list the user last looked at in this tab, with its filters, or to /jobs. Opened from that list, back
 * to the place in it they left (#409, list-place.tsx), like the browser's back.
 */
export function BackLink() {
  const t = useMessages(seekerJobsMessages).list;
  const router = useRouter();
  return (
    <Link
      href="/jobs"
      transitionTypes={BACK}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        const list = returnTo("/jobs");
        if (!list) return router.push(lastListHref(), { transitionTypes: BACK });
        markReturn();
        router.push(list, { transitionTypes: BACK, scroll: false });
      }}
      className="-my-2 inline-flex min-h-11 items-center gap-1 text-body text-muted hover:text-brand"
    >
      <span aria-hidden="true">←</span> {t.back}
    </Link>
  );
}
