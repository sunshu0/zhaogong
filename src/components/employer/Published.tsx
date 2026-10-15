"use client";
import Link from "next/link";
import type { RefObject } from "react";
import type { Employer, Job } from "@/lib/types";
import { ShareTexts } from "@/components/employer/ShareTexts";

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
  const live = job.status === "active";
  return (
    <section className="space-y-4">
      <div className={`rounded-xl px-4 py-5 ${live ? "bg-ok-soft" : "bg-warn-soft"}`}>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className={`text-xl font-semibold outline-none ${live ? "text-ok" : "text-warn"}`}
        >
          {live ? "已发布" : "已提交审核"}
        </h1>
        <p className="mt-1 text-sm">
          {job.titleZh} · {live ? "求职者现在就能看到。" : "审核通过后公开，可以在「职位管理」里看到进度。"}
        </p>
        {live && (
          <Link href={`/jobs/${job.id}`} className="mt-3 inline-block text-sm text-brand underline">
            看看职位页面 →
          </Link>
        )}
      </div>
      {live ? (
        <ShareTexts job={job} employer={employer} />
      ) : (
        <p className="text-sm text-muted">审核通过后，可以在「职位管理」里复制发到微信群、小红书和 Skykiwi 的文案。</p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onAgain}
          className="h-11 flex-1 rounded-xl border border-brand font-medium text-brand"
        >
          再发一条
        </button>
        <Link
          href="/employer/jobs"
          className="flex h-11 flex-1 items-center justify-center rounded-xl bg-brand font-medium text-white"
        >
          职位管理
        </Link>
      </div>
    </section>
  );
}
