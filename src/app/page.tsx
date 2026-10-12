import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { DEFAULT_COUNTRY } from "@/config/countries";
import { DEMO_DATA, visibleStats } from "@/config/landing";
import { PRODUCT_NAME } from "@/i18n/labels";
import { getPlatformStats, listFeaturedJobs } from "@/lib/data";
import { employersOf } from "@/components/seeker/employers";
import { filterToQuery, jobsHref, parseFilter } from "@/components/seeker/filter-query";
import { JobList, JobListSkeleton } from "@/components/seeker/JobList";
import { formatCount, POSITIONING } from "@/components/seeker/landing";
import { requestTime } from "@/components/seeker/request-time";

const TITLE = `${PRODUCT_NAME} · 奥克兰的中文工作平台`;
const DESCRIPTION = "时薪、地区、签证一目了然；雇主经过验证，职位发布前检查最低工资和违规收费；登录后才显示联系方式。";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", locale: "zh_CN" },
};

const EMPLOYER_POINTS = [
  "粘贴微信群里的招聘消息，自动整理成中英文职位",
  "发布前自动检查最低工资和违规用词",
  "一键复制到微信群、小红书和 Skykiwi",
];

const FEATURED_COUNT = 6;

/** The landing page: a first screen of its own, then featured jobs, what we stand for, and a part for employers. */
export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <div className="space-y-8">
      <Suspense fallback={null}>
        <LegacyListLink searchParams={searchParams} />
      </Suspense>

      {/* Fills the first phone screen below the 3.5rem header and main's 1rem top padding. */}
      <section
        aria-labelledby="hero-heading"
        className="flex min-h-[calc(100svh_-_4.5rem)] flex-col justify-center rounded-2xl bg-brand-soft px-5 py-8"
      >
        <p className="flex items-center gap-3">
          <Image src="/icons/icon-192.png" alt="" width={64} height={64} preload className="size-16" />
          <span className="text-4xl font-bold tracking-wider text-brand">{PRODUCT_NAME}</span>
        </p>
        <h1 id="hero-heading" className="mt-6 text-2xl leading-snug font-semibold">
          奥克兰的中文工作平台
        </h1>
        <p className="mt-2 text-muted">餐饮、零售、清洁、装修等工作，时薪、地区、签证写清楚，联系雇主更放心。</p>

        <div className="mt-6 flex gap-3">
          <Link
            href={`/login?next=${encodeURIComponent(jobsHref(""))}`}
            className="flex-1 rounded-lg bg-brand px-4 py-3 text-center font-medium text-white"
          >
            注册
          </Link>
          <Link
            href={jobsHref("")}
            className="flex-1 rounded-lg border border-brand bg-surface px-4 py-3 text-center font-medium text-brand"
          >
            直接浏览工作
          </Link>
        </div>

        <Suspense fallback={<div className="mt-8 h-32 animate-pulse rounded-xl bg-surface/60" aria-hidden="true" />}>
          <StatsStrip />
        </Suspense>

        <a href="#featured" className="mt-6 self-center text-sm text-muted hover:text-brand">
          看看精选工作 <span aria-hidden="true">↓</span>
        </a>
      </section>

      <Suspense fallback={<JobListSkeleton />}>
        <FeaturedJobs />
      </Suspense>

      <section aria-labelledby="positioning-heading">
        <h2 id="positioning-heading" className="mb-3 text-lg font-semibold">
          我们的定位
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {POSITIONING.map((block) => (
            <li key={block.title} className="rounded-xl border border-border bg-surface p-4">
              <p className="flex items-start gap-2 font-medium">
                <Check />
                {block.title}
              </p>
              <p className="mt-1 text-sm text-muted">{block.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="employer-heading" className="rounded-xl border border-border bg-surface p-4">
        <h2 id="employer-heading" className="font-medium">
          招人？一分钟发布招聘
        </h2>
        <ul className="mt-2 space-y-1 text-sm text-muted">
          {EMPLOYER_POINTS.map((point) => (
            <li key={point} className="flex items-start gap-2">
              <span aria-hidden="true">·</span>
              {point}
            </li>
          ))}
        </ul>
        <Link
          href="/employer"
          className="mt-3 inline-block rounded-lg border border-border px-4 py-2 text-sm hover:border-brand hover:text-brand"
        >
          雇主发布招聘 →
        </Link>
      </section>
    </div>
  );
}

/** Real counts from getPlatformStats, per request; while the data is demo data it says so. */
async function StatsStrip() {
  await connection();
  const stats = visibleStats(await getPlatformStats(DEFAULT_COUNTRY));
  if (stats.length === 0) return null;
  return (
    <section aria-label="平台数据" className="mt-8 rounded-xl bg-surface p-4">
      {DEMO_DATA && (
        <p className="mb-2 flex justify-end">
          <span className="rounded-full bg-warn-soft px-2 py-0.5 text-xs text-warn">演示数据</span>
        </p>
      )}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.key} className="flex flex-col-reverse">
            <dt className="text-xs text-muted">{stat.label}</dt>
            <dd className="text-2xl font-semibold text-brand tabular-nums">{formatCount(stat.value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

async function FeaturedJobs() {
  const now = await requestTime();
  const jobs = await listFeaturedJobs(DEFAULT_COUNTRY, FEATURED_COUNT);
  const employers = await employersOf(jobs);
  return (
    <section id="featured" aria-labelledby="featured-heading" className="scroll-mt-20">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 id="featured-heading" className="text-lg font-semibold">
          精选工作
        </h2>
        <Link href={jobsHref("")} className="text-sm text-brand">
          查看全部职位 →
        </Link>
      </div>
      <p className="mb-3 text-xs text-muted">来自已验证雇主、正在招聘的职位，时薪高的在前。</p>
      <JobList jobs={jobs} employers={employers} now={now} />
    </section>
  );
}

/** Links shared before the list moved to /jobs (/?industry=…) still open that filtered list. */
async function LegacyListLink({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const query = filterToQuery(parseFilter(await searchParams, DEFAULT_COUNTRY));
  if (query) redirect(jobsHref(query));
  return null;
}

function Check() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="mt-1 size-4 shrink-0 fill-brand">
      <path d="M6.4 11.2 3.2 8l1.1-1.1 2.1 2.1 5.3-5.3 1.1 1.1z" />
    </svg>
  );
}
