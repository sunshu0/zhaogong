"use client";

// 重复职位提醒 (#196): before publishing, says that the business already has a live job with this title, and links
// to it — renewing or editing that one is usually what the employer wants. A hint; publishing goes on as before.
import Link from "next/link";
import { useEffect, useState } from "react";
import { getMyLiveJobsTitled, type JobTwin } from "@/app/[lang]/employer/actions";
import { closeDateZh } from "@/components/employer/job-status";
import { useLang, useMessages } from "@/i18n/client";
import { contentLang } from "@/i18n/lang";
import { employerJobsMessages } from "@/i18n/messages/employer-jobs";

/** Asks the server once the title has stopped changing for a moment. */
function useLiveTwins(titleZh: string): JobTwin[] {
  const [found, setFound] = useState<{ title: string; twins: JobTwin[] }>();
  useEffect(() => {
    if (!titleZh.trim()) return;
    let live = true;
    const timer = setTimeout(() => {
      getMyLiveJobsTitled(titleZh)
        .then((twins) => {
          if (live) setFound({ title: titleZh, twins });
        })
        .catch(() => {});
    }, 400);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [titleZh]);
  return found?.title === titleZh && titleZh.trim() ? found.twins : [];
}

export function DuplicateJobNote({ titleZh }: { titleZh: string }) {
  const lang = useLang();
  const t = useMessages(employerJobsMessages).duplicate;
  const twins = useLiveTwins(titleZh);
  const first = twins[0];
  if (!first) return null;
  const more = twins.length > 1 ? t.andMore(twins.length) : "";
  const when = first.status === "pending_review" ? t.pendingReview : t.closesOn(closeDateZh(first.expiresAt, lang));
  return (
    <p role="status" className="rounded-control bg-warn-soft px-3 py-2 text-body text-warn">
      {/* The other job's title is the employer's own, so it says which language it is in (ADR 0023 §6). */}
      {t.noteBefore}
      <span lang={contentLang(first.titleZh)}>{first.titleZh}</span>
      {t.noteAfter(when, more)}
      <Link href={`/employer/jobs/${first.id}`} className="ml-1 font-medium text-brand underline underline-offset-4">
        {t.link}
      </Link>
    </p>
  );
}
