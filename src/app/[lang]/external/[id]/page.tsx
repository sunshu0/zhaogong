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
import { SECTION_PATHS } from "@/lib/external-jobs/filter";
import { externalWords, factLines, sourceLine } from "@/lib/external-jobs/labels";
import { externalMessages } from "@/i18n/messages/external";
import { messages, serverLang } from "@/i18n/server";
import { isShown, sectionOf } from "@/lib/external-jobs/visibility";
import { BACK, PageTransition } from "@/components/ui/PageTransition";

// An external job (#113, ADR 0014): its facts, where they come from and when they were read, and 去官网申请. No
// apply, chat or contact details here (Round 18 draft 3.8), no company logo, nobody's name. Kept out of search
// engines: the job belongs on the company's own site. 收藏 (#131) keeps it in 收藏和进度.
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await messages(externalMessages)).job.title, robots: { index: false, follow: false } };
}

const decode = (id: string) => {
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
};

const CARD = "rounded-card bg-surface p-4 shadow-card lg:p-6";

export default function ExternalJobPage({ params }: PageProps<"/[lang]/external/[id]">) {
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

async function ExternalJob({ params }: Pick<PageProps<"/[lang]/external/[id]">, "params">) {
  const job = await getExternalJob(decode((await params).id));
  const now = await requestTime();
  if (!job || !isShown(job, now)) notFound();
  const section = sectionOf(job.kind);
  const lang = await serverLang();
  const w = externalWords(lang);
  const t = w.job;
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
          {t.back(w.sections[section])}
        </Link>
      </p>
      <header className={CARD}>
        <div className="flex items-start justify-between gap-2">
          <ul aria-label={w.list.tags} className="flex flex-wrap gap-1.5">
            <li>
              <SoftTag tone="neutral">{w.name}</SoftTag>
            </li>
            <li>
              <SoftTag tone="brand">{w.fields[job.field]}</SoftTag>
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
        <p className="mt-1 text-meta text-muted">{sourceLine(job.companyName, job.lastSeenAt, lang)}</p>
        <div className="fixed inset-x-0 bottom-above-nav z-10 bg-surface/90 px-4 py-3 shadow-[0_-1px_0_var(--border)] backdrop-blur-md md:static md:z-auto md:mt-5 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none">
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`${buttonClass("primary", { block: true, size: "lg" })} font-semibold whitespace-nowrap md:w-auto`}
          >
            {t.apply}
          </a>
        </div>
      </header>
      <section aria-labelledby="facts-heading" className={CARD}>
        <h2 id="facts-heading" className="mb-3 text-subtitle font-semibold">
          {t.factsHeading}
        </h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 lg:grid-cols-3">
          {factLines(job, lang).map((line) => (
            <div key={line.label} className="min-w-0">
              <dt className="text-meta text-muted">{line.label}</dt>
              <dd className="mt-0.5 text-body font-medium break-words">{line.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 border-t border-border pt-3 text-meta text-muted">{t.factsNote}</p>
        <p className="mt-1 text-meta text-muted">{t.applyNote}</p>
      </section>
    </article>
  );
}
