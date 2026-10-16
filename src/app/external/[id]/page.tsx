import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TakedownNote } from "@/components/external/TakedownNote";
import { requestTime } from "@/components/seeker/request-time";
import { FinishSaveAfterSignIn, SaveJobButton } from "@/components/seeker/SaveJobButton";
import { externalSaveKey } from "@/components/seeker/saved-jobs";
import { buttonClass } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { WIDE_ON_DESKTOP } from "@/components/ui/wide";
import { getExternalJob } from "@/db/external-jobs";
import { SECTION_PATHS, SECTION_TITLES } from "@/lib/external-jobs/filter";
import { factLines, FIELD_LABELS, sourceLine } from "@/lib/external-jobs/labels";
import { isShown, sectionOf } from "@/lib/external-jobs/visibility";

// An external job (#113, ADR 0014): its facts, where they come from and when they were read, and 去官网申请. No
// apply, chat or contact details here (Round 18 draft 3.8), no company logo, nobody's name. Kept out of search
// engines: the job belongs on the company's own site. 收藏 (#131) keeps it in 收藏和进度.
export const metadata: Metadata = { title: "外部职位", robots: { index: false, follow: false } };

const decode = (id: string) => {
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
};

export default function ExternalJobPage({ params }: PageProps<"/external/[id]">) {
  return (
    <div className={`${WIDE_ON_DESKTOP} space-y-4`}>
      <FinishSaveAfterSignIn />
      <Suspense fallback={<div className="h-80 animate-pulse rounded-md bg-surface" />}>
        <ExternalJob params={params} />
      </Suspense>
      <TakedownNote />
    </div>
  );
}

async function ExternalJob({ params }: Pick<PageProps<"/external/[id]">, "params">) {
  const job = await getExternalJob(decode((await params).id));
  const now = await requestTime();
  if (!job || !isShown(job, now)) notFound();
  const section = sectionOf(job.kind);
  return (
    <article aria-labelledby="external-title" className="space-y-4 lg:max-w-3xl">
      <p className="text-meta">
        <Link href={SECTION_PATHS[section]} className="text-brand underline underline-offset-2">
          ← {SECTION_TITLES[section]}
        </Link>
      </p>
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="flex flex-wrap gap-1.5">
            <Tag kind="neutral">外部职位</Tag>
            <Tag kind="perk">{FIELD_LABELS[job.field]}</Tag>
          </p>
          <SaveJobButton jobId={externalSaveKey(job.id)} title={job.title} />
        </div>
        <h1 id="external-title" lang="en" className="text-title font-semibold">
          {job.title}
        </h1>
        <p className="text-body" lang="en">
          {job.companyName}
        </p>
        <p className="text-meta text-muted">{sourceLine(job.companyName, job.lastSeenAt)}</p>
      </div>
      <section
        aria-labelledby="facts-heading"
        className="-mx-4 border-y border-border bg-surface px-4 py-3 sm:mx-0 sm:rounded-md sm:border sm:px-5"
      >
        <h2 id="facts-heading" className="mb-2 text-body font-medium">
          职位信息（按官网原文整理）
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-body">
          {factLines(job).map((line) => (
            <div key={line.label} className="contents">
              <dt className="text-muted">{line.label}</dt>
              <dd>{line.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-meta text-muted">
          只列原文写明的事实；签证一项只照录原文，不是签证建议。详细要求、职责和申请方式以官网为准。
        </p>
      </section>
      <p>
        <a href={job.url} target="_blank" rel="noopener noreferrer" className={buttonClass("primary", { block: true })}>
          去官网申请（新窗口）
        </a>
      </p>
      <p className="text-meta text-muted">申请直接交给公司，找工看不到也不经手你的申请。</p>
    </article>
  );
}
