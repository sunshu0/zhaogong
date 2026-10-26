"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { lastListHref } from "@/components/seeker/last-list";
import { BACK } from "@/components/ui/PageTransition";
import { useMessages } from "@/i18n/client";
import { seekerJobsMessages } from "@/i18n/messages/seeker-jobs";

/** Back to the list the user last looked at in this tab, with its filters, or to /jobs. */
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
        router.push(lastListHref(), { transitionTypes: BACK });
      }}
      className="-my-2 inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-brand"
    >
      <span aria-hidden="true">←</span> {t.back}
    </Link>
  );
}
