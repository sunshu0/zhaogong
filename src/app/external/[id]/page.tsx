import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TakedownNote } from "@/components/external/TakedownNote";
import { NoScriptStreams } from "@/components/seeker/NoScriptStreams";
import { requestTime } from "@/components/seeker/request-time";
import { FinishSaveAfterSignIn, SaveJobButton } from "@/components/seeker/SaveJobButton";
import { externalSaveKey } from "@/components/seeker/saved-jobs";
import { buttonClass } from "@/components/ui/Button";
import { SoftTag } from "@/components/ui/Tag";
import { DetailPageSkeleton } from "@/components/ui/Skeleton";
import { WIDE_ON_DESKTOP } from "@/components/ui/wide";
import { getExternalJob } from "@/db/external-jobs";
import { SECTION_PATHS, SECTION_TITLES } from "@/lib/external-jobs/filter";
import { factLines, FIELD_LABELS, sourceLine } from "@/lib/external-jobs/labels";
import { isShown, sectionOf } from "@/lib/external-jobs/visibility";
import { BACK, PageTransition } from "@/components/ui/PageTransition";

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

const CARD = "rounded-card bg-surface p-4 shadow-card lg:p-6";

export default function ExternalJobPage({ params }: PageProps<"/external/[id]">) {
  return (
    <PageTransition>
      <div className={`${WIDE_ON_DESKTOP} type-app space-y-4`}>
        <NoScriptStreams />
        <FinishSaveAfterSignIn />
        <Suspense fallback={<DetailPageSkeleton />}>
          <ExternalJob params={params} />
        </Suspense>
        <TakedownNote />
      </div>
    </PageTransition>
  );
}

async function ExternalJob({ params }: Pick<PageProps<"/external/[id]">, "params">) {
  const job = await getExternalJob(decode((await params).id));
  const now = await requestTime();
  if (!job || !isShown(job, now)) notFound();
  const section = sectionOf(job.kind);
  // Round 19, like the job page: a title card, the facts in a card, and the one action in a bar above the bottom
  // navigation on phones (at the foot of the title card from 768 px), with room for it at the end of the page.
  return (
    <article aria-labelledby="external-title" className="space-y-3 pb-24 md:pb-0 lg:max-w-3xl">
      <p className="text-meta">
        <Link
          href={SECTION_PATHS[section]}
          transitionTypes={BACK}
          className="pressable inline-flex min-h-11 items-center text-brand"
        >
          ← {SECTION_TITLES[section]}
        </Link>
      </p>
      <header className={CARD}>
        <div className="flex items-start justify-between gap-2">
          <ul aria-label="标签" className="flex flex-wrap gap-1.5">
            <li>
              <SoftTag tone="neutral">外部职位</SoftTag>
            </li>
            <li>
              <SoftTag tone="brand">{FIELD_LABELS[job.field]}</SoftTag>
            </li>
          </ul>
          <SaveJobButton jobId={externalSaveKey(job.id)} title={job.title} />
        </div>
        <h1 id="external-title" lang="en" className="mt-2 text-title font-semibold break-words">
          {job.title}
        </h1>
        <p className="mt-1 text-subtitle" lang="en">
          {job.companyName}
        </p>
        <p className="mt-1 text-meta text-muted">{sourceLine(job.companyName, job.lastSeenAt)}</p>
        <div className="fixed inset-x-0 bottom-above-nav z-10 bg-surface/90 px-4 py-3 shadow-[0_-1px_0_var(--border)] backdrop-blur-md md:static md:z-auto md:mt-5 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none">
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`${buttonClass("primary", { block: true, size: "lg" })} font-semibold whitespace-nowrap md:w-auto`}
          >
            去官网申请（新窗口）
          </a>
        </div>
      </header>
      <section aria-labelledby="facts-heading" className={CARD}>
        <h2 id="facts-heading" className="mb-3 text-subtitle font-semibold">
          职位信息（按官网原文整理）
        </h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 lg:grid-cols-3">
          {factLines(job).map((line) => (
            <div key={line.label} className="min-w-0">
              <dt className="text-meta text-muted">{line.label}</dt>
              <dd className="mt-0.5 text-body font-medium break-words">{line.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 border-t border-border pt-3 text-meta text-muted">
          只列原文写明的事实；签证一项只照录原文，不是签证建议。详细要求、职责和申请方式以官网为准。
        </p>
        <p className="mt-1 text-meta text-muted">申请直接交给公司，找工看不到也不经手你的申请。</p>
      </section>
    </article>
  );
}
