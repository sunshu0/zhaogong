import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Fragment, Suspense } from "react";
import { DEFAULT_COUNTRY, regionById } from "@/config/countries";
import { DEMO_DATA, visibleStats } from "@/config/landing";
import { PRODUCT_NAME } from "@/i18n/labels";
import type { JobFilter } from "@/lib/types";
import { englishSummary, parsePost } from "@/lib/ai-post";
import { getPlatformStats, listFeaturedJobs, listJobs } from "@/lib/data";
import { employersOf } from "@/components/seeker/employers";
import { filterToQuery, jobsHref, parseFilter } from "@/components/seeker/filter-query";
import { JobCard } from "@/components/seeker/JobCard";
import { PostJobLink } from "@/components/seeker/AccountMenu";
import { buildReplay } from "@/components/seeker/chat-replay";
import { ChatReplay } from "@/components/seeker/ChatReplay";
import { AI_FEATURE, EMPLOYER_EXAMPLE, FEATURES, formatCount, heroCounts } from "@/components/seeker/landing";
import { BeforeAfter, CheckIcon, FeatureIconSvg } from "@/components/seeker/landing-parts";
import { WindowNotices } from "@/components/seeker/WindowNotices";
import { formatPay } from "@/components/seeker/format";
import { requestTime } from "@/components/seeker/request-time";
import { FULL_BLEED, SITE_CONTAINER } from "@/components/ui/wide";

const TITLE = `${PRODUCT_NAME} · 奥克兰的中文工作平台`;
const DESCRIPTION =
  "时薪、地区、签证一目了然；雇主经过验证，职位发布前检查最低工资和违规收费；联系方式只给登录的求职者，或在聊天中双方同意后交换。";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", locale: "zh_CN" },
};

/** One tap into /jobs with a filter it already has. */
const QUICK_FILTERS: { label: string; filter: Omit<JobFilter, "country"> }[] = [
  { label: "接受学签", filter: { visa: "student" } },
  { label: "包餐", filter: { mealsIncluded: true } },
  { label: "兼职", filter: { employmentTypes: ["part_time"] } },
  { label: "市中心", filter: { regionIds: ["akl-cbd"] } },
];

const NOTICE_COUNT = 3;

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

      <section aria-labelledby="hero-heading" className={`${FULL_BLEED} bg-background`}>
        <div
          className={`${SITE_CONTAINER} grid gap-6 pt-6 pb-2 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-center lg:gap-10 lg:pt-14 lg:pb-6`}
        >
          <div>
            <h1 id="hero-heading" className="text-[1.75rem] leading-tight font-black lg:text-[3.25rem]">
              奥克兰的中文工作，
              <br />
              时薪写在最前面。
            </h1>
            <p className="mt-3 max-w-xl text-body leading-relaxed text-muted lg:text-subtitle">
              餐饮、零售、清洁、装修。每个职位发布前都核对过最低工资，雇主有没有通过验证、接受哪些签证，都写得清清楚楚。
            </p>
            <form action={jobsHref("")} role="search" className="mt-5 flex max-w-xl">
              <input
                type="search"
                name="q"
                maxLength={50}
                enterKeyHint="search"
                placeholder="服务员、厨师、Mt Eden…"
                aria-label="搜索职位"
                className="min-w-0 flex-1 rounded-l-md border border-r-0 border-brand bg-surface px-3.5 py-3 text-base outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
              <button
                type="submit"
                className="shrink-0 rounded-r-md bg-brand px-4 font-bold text-white hover:bg-brand/90"
              >
                找工作
              </button>
            </form>
            <ul aria-label="快捷筛选" className="mt-3 flex flex-wrap gap-2">
              {QUICK_FILTERS.map((quick) => (
                <li key={quick.label}>
                  <Link
                    href={jobsHref(filterToQuery({ country: DEFAULT_COUNTRY, ...quick.filter }))}
                    className="inline-block rounded-sm bg-brand-soft px-2.5 py-1.5 text-body text-brand hover:bg-brand hover:text-white"
                  >
                    {quick.label}
                  </Link>
                </li>
              ))}
            </ul>
            {/* Round 18 (#113): external jobs from companies' own sites. */}
            <p className="mt-3 text-body">
              找软件、电子电气方向的工作？看{" "}
              <Link href="/internships" className="font-medium text-brand underline underline-offset-2">
                实习
              </Link>{" "}
              和{" "}
              <Link href="/professional" className="font-medium text-brand underline underline-offset-2">
                专业职位
              </Link>
              （来自公司官网）
            </p>
            <Suspense fallback={<p className="mt-4 h-6" />}>
              <HeroCount />
            </Suspense>
          </div>

          <Suspense fallback={<div className="h-72 lg:h-[26rem]" />}>
            <HeroNotices />
          </Suspense>
        </div>
      </section>

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
        <div className="rounded-md border border-border bg-surface p-4 text-sm">
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

/** 橱窗告示: three real open jobs from verified employers, best pay first. */
async function HeroNotices() {
  await connection();
  const jobs = await listFeaturedJobs(DEFAULT_COUNTRY, NOTICE_COUNT, await requestTime());
  return <WindowNotices jobs={jobs} employers={await employersOf(jobs)} />;
}

/**
 * The home page's one line of numbers (#51): 「N 个职位在招，来自 M 家已验证雇主」 from the open jobs, then hires and
 * contacts where they may be shown (heroCounts), per request; while the data is demo data it says so.
 */
async function HeroCount() {
  const now = await requestTime();
  const [jobs, stats] = await Promise.all([
    listJobs({ country: DEFAULT_COUNTRY }, now),
    getPlatformStats(DEFAULT_COUNTRY),
  ]);
  const employers = await employersOf(jobs);
  const verified = [...employers.values()].filter((e) => e.verification !== "unverified").length;
  const [open, by, ...more] = heroCounts(jobs.length, verified, stats);
  const figure = (n: number) => <b className="font-figure text-[1.375rem] text-foreground">{formatCount(n)}</b>;
  return (
    <p data-hero-counts="" className="mt-4 text-body text-muted">
      <span className="whitespace-nowrap">
        {figure(open.value)} {open.label} {figure(by.value)} {by.label}
      </span>
      {more.map((part) => (
        // The space between parts is outside the unbreakable part, so the line can wrap there.
        <Fragment key={part.label}>
          {" "}
          <span className="whitespace-nowrap">
            · {figure(part.value)} {part.label}
          </span>
        </Fragment>
      ))}
      {DEMO_DATA && (
        <span className="ml-2 inline-block rounded-sm bg-warn-soft px-1.5 py-0.5 text-meta whitespace-nowrap text-warn">
          演示数据
        </span>
      )}
    </p>
  );
}

async function FeaturedBand() {
  await connection(); // featured jobs change as jobs are published
  const jobs = await listFeaturedJobs(DEFAULT_COUNTRY, FEATURED_COUNT, await requestTime());
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
        <ul className="mt-6 space-y-3">
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
          <article aria-labelledby="ai-feature-heading" className="border-t-2 border-brand pt-4">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-brand text-white">
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
          {/* Thin lines between the features (Round 13), no cards. */}
          <ul className="divide-y divide-border border-y border-border">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="flex items-start gap-3 py-5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
                  <FeatureIconSvg name={feature.icon} />
                </span>
                <div>
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{feature.text}</p>
                </div>
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
