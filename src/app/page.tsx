import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DEFAULT_COUNTRY, regionById } from "@/config/countries";
import { DEMO_DATA, visibleStats } from "@/config/landing";
import { PRODUCT_NAME } from "@/i18n/labels";
import { englishSummary, parsePost } from "@/lib/ai-post";
import { getPlatformStats, listFeaturedJobs } from "@/lib/data";
import { employersOf } from "@/components/seeker/employers";
import { filterToQuery, jobsHref, parseFilter } from "@/components/seeker/filter-query";
import { JobCard } from "@/components/seeker/JobCard";
import { CountUpStats } from "@/components/seeker/CountUpStats";
import { PostJobLink } from "@/components/seeker/AccountMenu";
import { buildReplay } from "@/components/seeker/chat-replay";
import { ChatReplay } from "@/components/seeker/ChatReplay";
import { AI_FEATURE, EMPLOYER_EXAMPLE, FEATURES } from "@/components/seeker/landing";
import { BeforeAfter, CheckIcon, FeatureIconSvg, JobStack } from "@/components/seeker/landing-parts";
import { formatPay } from "@/components/seeker/format";
import { FULL_BLEED, SITE_CONTAINER } from "@/components/ui/wide";

const TITLE = `${PRODUCT_NAME} · 奥克兰的中文工作平台`;
const DESCRIPTION = "时薪、地区、签证一目了然；雇主经过验证，职位发布前检查最低工资和违规收费；登录后才显示联系方式。";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", locale: "zh_CN" },
};

const TRUST = ["雇主验证", "发布前查合规", "对求职者免费"];

const EMPLOYER_POINTS = [
  "粘贴微信群里的招聘消息，自动整理成中英文职位",
  "发布前自动检查最低工资和违规用词",
  "一键复制到微信群、小红书和 Skykiwi",
];

const FEATURED_COUNT = 6;

/** The landing page: full-bleed bands, content in the site container. Pictures and numbers come from real data. */
export default function Home({ searchParams }: PageProps<"/">) {
  return (
    // The bands meet the header and the footer: cancel main's vertical padding.
    <div className="-mt-4 -mb-4">
      <Suspense fallback={null}>
        <LegacyListLink searchParams={searchParams} />
      </Suspense>
      <NoScriptLanding />

      <section
        aria-labelledby="hero-heading"
        className={`${FULL_BLEED} relative overflow-hidden bg-linear-135 from-brand via-[#0c5f59] to-[#073b37] text-white`}
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={DOT_GRID} />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -bottom-20 text-[18rem] leading-none font-bold text-white/[0.06] select-none lg:right-[4%] lg:-bottom-28 lg:text-[30rem]"
        >
          找
        </span>

        <div
          className={`${SITE_CONTAINER} relative grid items-center gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_26rem] lg:py-20`}
        >
          <div>
            <p className="flex items-center gap-3">
              <Image
                src="/icons/icon-192.png"
                alt=""
                width={56}
                height={56}
                preload
                className="size-14 rounded-[22%] ring-2 ring-white/40"
              />
              <span className="text-3xl font-bold tracking-wider">{PRODUCT_NAME}</span>
            </p>
            <h1 id="hero-heading" className="mt-6 text-3xl leading-tight font-bold lg:text-[3.25rem]">
              奥克兰的中文工作平台
            </h1>
            <p className="mt-3 max-w-xl text-base text-white lg:mt-4 lg:max-w-[40rem] lg:text-lg">
              餐饮、零售、清洁、装修等工作，时薪、地区、签证写清楚，联系雇主更放心。
            </p>
            <div className="mt-7 flex gap-3">
              <Link
                href="/login?role=seeker"
                className="flex-1 rounded-lg bg-white px-6 py-3 text-center font-semibold text-brand hover:bg-white/90 lg:flex-none"
              >
                注册找工作
              </Link>
              <Link
                href={jobsHref("")}
                className="flex-1 rounded-lg border border-white/80 px-6 py-3 text-center font-semibold text-white hover:bg-white/10 lg:flex-none"
              >
                直接浏览工作
              </Link>
            </div>
            <p className="mt-4 text-sm text-white">
              招人？{" "}
              <PostJobLink className="font-medium underline underline-offset-4 hover:no-underline">
                我要招人 →
              </PostJobLink>
            </p>
            <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white" aria-label="我们的承诺">
              {TRUST.map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <CheckIcon />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="hidden lg:block">
            <Suspense fallback={<div className="h-[26rem]" />}>
              <HeroPicture />
            </Suspense>
          </div>
        </div>
      </section>

      <Suspense fallback={<div className={`${FULL_BLEED} h-56 border-b border-border bg-surface`} />}>
        <StatsBand />
      </Suspense>

      <FeaturesBand />

      <Suspense fallback={<div className={`${FULL_BLEED} h-96`} />}>
        <FeaturedBand />
      </Suspense>

      <EmployerBand />
    </div>
  );
}

/**
 * A small server-rendered safety net for browsers with JavaScript disabled. The main stats and
 * featured sections intentionally stream behind Suspense, but a no-JS browser cannot run the
 * inline React swap that replaces those fallbacks. Keep the fallback data-driven and compact;
 * with JavaScript enabled <noscript> is ignored by the browser.
 */
async function NoScriptLanding() {
  const [stats, jobs] = await Promise.all([
    getPlatformStats(DEFAULT_COUNTRY).then(visibleStats),
    listFeaturedJobs(DEFAULT_COUNTRY, 3),
  ]);
  if (stats.length === 0 && jobs.length === 0) return null;

  return (
    <noscript>
      <div className={`${SITE_CONTAINER} py-4`}>
        <div className="rounded-xl border border-border bg-surface p-4 text-sm">
          {stats.length > 0 && (
            <section aria-labelledby="no-js-stats-heading">
              <h2 id="no-js-stats-heading" className="font-semibold">
                平台数据
              </h2>
              <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {stats.map((stat) => (
                  <div key={stat.key}>
                    <dd className="text-lg font-semibold text-brand">{stat.value}</dd>
                    <dt className="text-xs text-muted">{stat.label}</dt>
                  </div>
                ))}
              </dl>
            </section>
          )}
          {jobs.length > 0 && (
            <section
              aria-labelledby="no-js-jobs-heading"
              className={stats.length > 0 ? "mt-4 border-t border-border pt-4" : undefined}
            >
              <h2 id="no-js-jobs-heading" className="font-semibold">
                精选工作
              </h2>
              <ul className="mt-2 grid grid-cols-1 gap-2">
                {jobs.map((job) => (
                  <li key={job.id}>
                    <Link
                      href={`/jobs/${job.id}`}
                      className="block rounded-lg border border-border p-3 hover:border-brand"
                    >
                      <span className="block font-medium">{job.titleZh}</span>
                      <span className="block text-xs text-muted">
                        {formatPay(job.pay, job.country)} · {regionById(job.country, job.regionId)?.nameZh ?? "奥克兰"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href={jobsHref("")} className="mt-3 inline-block text-brand underline underline-offset-2">
                浏览全部职位 →
              </Link>
            </section>
          )}
        </div>
      </div>
    </noscript>
  );
}

const DOT_GRID = {
  backgroundImage: "radial-gradient(rgb(255 255 255 / 0.13) 1px, transparent 1.6px)",
  backgroundSize: "22px 22px",
  maskImage: "linear-gradient(to bottom, black, transparent 90%)",
};

async function HeroPicture() {
  await connection();
  const jobs = await listFeaturedJobs(DEFAULT_COUNTRY, 3);
  return <JobStack jobs={jobs} employers={await employersOf(jobs)} />;
}

/** Real counts from getPlatformStats, per request, counting up on screen; while the data is demo data it says so. */
async function StatsBand() {
  await connection();
  const stats = visibleStats(await getPlatformStats(DEFAULT_COUNTRY));
  if (stats.length === 0) return null;
  return (
    <section aria-labelledby="stats-heading" className={`${FULL_BLEED} border-b border-border bg-surface`}>
      <div className={`${SITE_CONTAINER} py-8 lg:py-10`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="stats-heading" className="text-sm font-medium text-muted">
            平台数据
          </h2>
          {DEMO_DATA && <span className="rounded-full bg-warn-soft px-2 py-0.5 text-xs text-warn">演示数据</span>}
        </div>
        <CountUpStats stats={stats} />
      </div>
    </section>
  );
}

async function FeaturedBand() {
  await connection(); // featured jobs change as jobs are published
  const jobs = await listFeaturedJobs(DEFAULT_COUNTRY, FEATURED_COUNT);
  const employers = await employersOf(jobs);
  return (
    <section id="featured" aria-labelledby="featured-heading" className={`${FULL_BLEED} scroll-mt-16`}>
      <div className={`${SITE_CONTAINER} py-12 lg:py-16`}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="featured-heading" className="text-2xl font-bold">
              精选工作
            </h2>
            <p className="mt-1 text-sm text-muted">来自已验证雇主、正在招聘的职位，时薪高的在前。</p>
          </div>
          <Link href={jobsHref("")} className="font-medium text-brand">
            查看全部职位 →
          </Link>
        </div>
        <ul className="mt-6 grid grid-cols-1 gap-4">
          {jobs.map((job) => (
            <li key={job.id}>
              <JobCard job={job} employer={employers.get(job.employerId)} headingLevel={3} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** 功能展示: the AI chat post with a replay of a real conversation, then three more features. */
async function FeaturesBand() {
  const replay = await buildReplay();
  return (
    <section aria-labelledby="features-heading" className={`${FULL_BLEED} border-y border-border bg-surface`}>
      <div className={`${SITE_CONTAINER} py-12 lg:py-16`}>
        <h2 id="features-heading" className="text-2xl font-bold">
          功能展示
        </h2>
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-start">
          <article
            aria-labelledby="ai-feature-heading"
            className="rounded-2xl border border-brand/30 bg-brand-soft/50 p-4 lg:p-5"
          >
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand text-white">
                <FeatureIconSvg name="chat" />
              </span>
              <div>
                <h3 id="ai-feature-heading" className="font-semibold">
                  {AI_FEATURE.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{AI_FEATURE.text}</p>
              </div>
            </div>
            <div className="mt-4">
              <ChatReplay messages={replay} />
            </div>
          </article>
          <ul className="grid gap-4">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="rounded-2xl border border-border p-5">
                <span className="flex size-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <FeatureIconSvg name={feature.icon} />
                </span>
                <h3 className="mt-4 font-semibold">{feature.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{feature.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** For employers: a WeChat message turned into a job by the same parser the post flow uses. */
async function EmployerBand() {
  const { draft } = await parsePost(EMPLOYER_EXAMPLE, DEFAULT_COUNTRY);
  return (
    <section aria-labelledby="employer-heading" className={`${FULL_BLEED} bg-foreground text-white`}>
      <div
        className={`${SITE_CONTAINER} grid items-center gap-10 py-12 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:py-16`}
      >
        <div>
          <p className="text-sm text-white/75">给雇主</p>
          <h2 id="employer-heading" className="mt-1 text-2xl font-bold">
            招人？一分钟发布招聘
          </h2>
          <ul className="mt-4 space-y-2 text-sm text-white/90">
            {EMPLOYER_POINTS.map((point) => (
              <li key={point} className="flex items-start gap-2">
                <CheckIcon className="mt-0.5 size-4" />
                {point}
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            <PostJobLink className="inline-block rounded-lg bg-white px-5 py-2.5 font-semibold text-foreground hover:bg-white/90">
              注册雇主 →
            </PostJobLink>
            <Link href="/employer" className="text-sm text-white underline underline-offset-4 hover:no-underline">
              看看雇主能做什么
            </Link>
          </div>
        </div>
        <BeforeAfter message={EMPLOYER_EXAMPLE} draft={draft} summaryEn={englishSummary(draft, DEFAULT_COUNTRY)} />
      </div>
    </section>
  );
}

/** Links shared before the list moved to /jobs (/?industry=…) still open that filtered list. */
async function LegacyListLink({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const query = filterToQuery(parseFilter(await searchParams, DEFAULT_COUNTRY));
  if (query) redirect(jobsHref(query));
  return null;
}
