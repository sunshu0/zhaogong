"use client";
import Link from "next/link";
import type { RefObject } from "react";
import type { Employer, Job } from "@/lib/types";
import { ShareTexts } from "@/components/employer/ShareTexts";
import { buttonClass } from "@/components/ui/Button";
import { useMessages } from "@/i18n/client";
import { contentLang } from "@/i18n/lang";
import { employerPostMessages } from "@/i18n/messages/employer-post";

/** After 发布: live now (with the texts to share), or waiting for review. */
export function Published({
  job,
  employer,
  headingRef,
  onAgain,
}: {
  job: Job;
  employer?: Employer;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onAgain: () => void;
}) {
  const t = useMessages(employerPostMessages).published;
  const live = job.status === "active";
  return (
    <section className="space-y-4">
      <div className={`animate-pop-in rounded-card px-4 py-5 ${live ? "bg-ok-soft" : "bg-warn-soft"}`}>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className={`text-title font-semibold outline-none ${live ? "text-ok" : "text-warn"}`}
        >
          {live ? t.live : t.pendingReview}
        </h1>
        <p className="mt-1 text-body">
          <span lang={contentLang(job.titleZh)}>{job.titleZh}</span> · {live ? t.liveNote : t.pendingNote}
        </p>
        {live && (
          <Link
            href={`/jobs/${job.id}`}
            className="pressable mt-2 inline-flex min-h-11 items-center text-body text-brand underline"
          >
            {t.seeJobPage} →
          </Link>
        )}
      </div>
      {live ? <ShareTexts job={job} employer={employer} /> : <p className="text-body text-muted">{t.pendingShare}</p>}
      <div className="flex gap-3">
        <button type="button" onClick={onAgain} className={`${buttonClass("secondary", { size: "lg" })} flex-1`}>
          {t.postAnother}
        </button>
        <Link href="/employer/jobs" className={`${buttonClass("primary", { size: "lg" })} flex-1`}>
          {t.myJobs}
        </Link>
      </div>
    </section>
  );
}
