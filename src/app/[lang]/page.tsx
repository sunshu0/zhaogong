import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Fragment, Suspense } from "react";
import { DEFAULT_COUNTRY, regionById } from "@/config/countries";
import { DEMO_DATA } from "@/config/landing";
import { PRODUCT_NAME } from "@/i18n/labels";
import type { Job, JobFilter } from "@/lib/types";
import { englishSummary, parsePost } from "@/lib/ai-post";
import { getPlatformStats, listEmployers, listFeaturedJobs, listJobs, newestFirst } from "@/lib/data";
import { employersOf } from "@/components/seeker/employers";
import { employerActivities } from "@/db/employer-activity";
import { filterToQuery, jobsHref, parseFilter } from "@/components/seeker/filter-query";
import { JobCard } from "@/components/seeker/JobCard";
import { PostJobLink } from "@/components/seeker/AccountMenu";
import { buildReplay } from "@/components/seeker/chat-replay";
import { ChatReplay } from "@/components/seeker/ChatReplay";
import {
  aiFeature,
  EMPLOYER_EXAMPLE,
  features,
  formatCount,
  heroCounts,
  latestVerifiedJobs,
  statLines,
} from "@/components/seeker/landing";
import { BeforeAfter, CheckIcon, FeatureIconSvg } from "@/components/seeker/landing-parts";
import { WindowNotices } from "@/components/seeker/WindowNotices";
import { formatPay, placeName } from "@/components/seeker/format";
import { requestTime } from "@/components/seeker/request-time";
import { FULL_BLEED, SITE_CONTAINER } from "@/components/ui/wide";
import { sheetClass } from "@/components/ui/Card";
import { Skeleton, SkeletonList } from "@/components/ui/Skeleton";
import { PageTransition } from "@/components/ui/PageTransition";
import { contentLang } from "@/i18n/lang";
import { seekerHomeMessages } from "@/i18n/messages/seeker-home";
import { messages, serverLang } from "@/i18n/server";
import { TrackView } from "@/components/ui/TrackView";
import { demoDataWanted } from "@/db/ready";
import { PreparingMark } from "@/components/external/PreparingMark";

export async function generateMetadata(): Promise<Metadata> {
  const t = await messages(seekerHomeMessages);
  const title = `${PRODUCT_NAME} · ${t.title}`;
  const locale = (await serverLang()) === "en" ? "en_NZ" : "zh_CN";
  return {
    title: { absolute: title },
    description: t.description,
    openGraph: { title, description: t.description, type: "website", locale },
  };
}

/** One tap into /jobs with a filter it already has; `word` names it in the seeker-home dictionary. */
const QUICK_FILTERS: {
  word: "quickStudent" | "quickMeals" | "quickPartTime" | "quickCbd";
  filter: Omit<JobFilter, "country">;
}[] = [
  { word: "quickStudent", filter: { visa: "student" } },
  { word: "quickMeals", filter: { mealsIncluded: true } },
  { word: "quickPartTime", filter: { employmentTypes: ["part_time"] } },
  { word: "quickCbd", filter: { regionIds: ["akl-cbd"] } },
];

const NOTICE_COUNT = 3;

const EMPLOYER_POINTS = ["pointPaste", "pointChecks", "pointShare"] as const;

const LATEST_COUNT = 6;

/** The landing page: full-bleed bands, content in the site container. Pictures and numbers come from real data. */
export default async function Home({ searchParams }: PageProps<"/[lang]">) {
  const t = await messages(seekerHomeMessages);
  return (
    // The bands meet the header and the footer: cancel main's vertical padding.
    <PageTransition>
      <div className="type-app -mt-4 -mb-4">
        <Suspense fallback={null}>
          <LegacyListLink searchParams={searchParams} />
        </Suspense>
        {/* The search funnel's first step from the home page (#319, ADR 0025). */}
        <TrackView event={{ name: "home_view", path: "/" }} />
        <NoScriptLanding />
        {/* Without JavaScript nothing replaces the skeletons below (#167): hide them; NoScriptLanding has the data. */}
        <noscript>
          <style>{"[data-nojs-hide]{display:none!important}"}</style>
        </noscript>

        <section aria-labelledby="hero-heading" className={`${FULL_BLEED} bg-background`}>
          <div
            className={`${SITE_CONTAINER} grid gap-6 pt-6 pb-2 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-center lg:gap-10 lg:pt-14 lg:pb-6`}
          >
            <div>
              <h1 id="hero-heading" className="text-[1.75rem] leading-tight font-black lg:text-[3.25rem]">
                {t.hero.line1}
                <br />
                {t.hero.line2}
              </h1>
              <p className="mt-3 max-w-xl text-body leading-relaxed text-muted lg:text-subtitle">{t.hero.lead}</p>
              <form
                action={jobsHref("")}
                role="search"
                className="mt-5 flex h-14 max-w-xl items-center gap-2 rounded-control bg-surface p-1.5 pl-3.5 shadow-card focus-within:ring-2 focus-within:ring-brand/40"
              >
                <input
                  type="search"
                  name="q"
                  maxLength={50}
                  enterKeyHint="search"
                  placeholder={t.hero.searchPlaceholder}
                  aria-label={t.hero.search}
                  className="h-full min-w-0 flex-1 bg-transparent text-base outline-none"
                />
                <button
                  type="submit"
                  className="pressable h-full shrink-0 rounded-control bg-accent px-4 font-bold text-white hover:bg-accent-strong active:bg-accent-strong"
                >
                  {t.hero.submit}
                </button>
              </form>
              <ul aria-label={t.hero.quick} className="mt-3 flex flex-wrap gap-2">
                {QUICK_FILTERS.map((quick) => (
                  <li key={quick.word}>
                    <Link
                      href={jobsHref(filterToQuery({ country: DEFAULT_COUNTRY, ...quick.filter }))}
                      className="pressable inline-flex min-h-11 items-center rounded-full bg-brand-soft px-4 text-body text-brand hover:bg-brand hover:text-white md:min-h-9 md:px-3.5"
                    >
                      {t.hero[quick.word]}
                    </Link>
                  </li>
                ))}
              </ul>
              {/* Round 18 (#113): external jobs from companies' own sites. */}
              <p className="mt-3 text-body">
                {t.hero.externalBefore}{" "}
                <Link href="/internships" className="font-medium text-brand underline underline-offset-2">
                  {t.hero.internships}
                  <Suspense fallback={null}>
                    <PreparingMark section="internship" />
                  </Suspense>
                </Link>{" "}
                {t.hero.and}{" "}
                <Link href="/professional" className="font-medium text-brand underline underline-offset-2">
                  {t.hero.professional}
                  <Suspense fallback={null}>
                    <PreparingMark section="professional" />
                  </Suspense>
                </Link>
                {t.hero.externalAfter}
              </p>
              <Suspense
                fallback={
                  <div data-nojs-hide="">
                    <Skeleton className="mt-4 h-6 w-72 max-w-full" />
                  </div>
                }
              >
                <HeroCount />
              </Suspense>
            </div>

            <Suspense fallback={<NoticesSkeleton />}>
              <HeroNotices />
            </Suspense>
          </div>
        </section>

        {/* Feedback 8 (10-30): the jobs first, then what the site does; the AI chat post is for employers. */}
        <Suspense fallback={<LatestSkeleton />}>
          <LatestBand />
        </Suspense>

        <FeaturesBand />

        <EmployerBand />
      </div>
    </PageTransition>
  );
}

/**
 * A small server-rendered safety net for browsers with JavaScript disabled. The main stats and
 * featured sections intentionally stream behind Suspense, but a no-JS browser cannot run the
 * inline React swap that replaces those fallbacks. Keep the fallback data-driven and compact;
 * with JavaScript enabled <noscript> is ignored by the browser.
 */
async function NoScriptLanding() {
  const lang = await serverLang();
  const t = await messages(seekerHomeMessages);
  const [stats, jobs] = await Promise.all([
    getPlatformStats(DEFAULT_COUNTRY).then((all) => statLines(all, lang)),
    latestJobs(3),
  ]);
  if (stats.length === 0 && jobs.length === 0) return null;

  return (
    <noscript>
      <div className={`${SITE_CONTAINER} py-4`}>
        <div className={`text-body ${sheetClass()}`}>
          {stats.length > 0 && (
            <section aria-labelledby="no-js-stats-heading">
              <h2 id="no-js-stats-heading" className="font-semibold">
                {t.stats}
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
                {t.featured.title}
              </h2>
              <ul className="mt-2 grid grid-cols-1 gap-2">
                {jobs.map((job) => (
                  <li key={job.id}>
                    <Link href={`/jobs/${job.id}`} className="block rounded-control bg-background p-3 hover:text-brand">
                      <span lang={contentLang(job.titleZh)} className="block font-medium">
                        {job.titleZh}
                      </span>
                      <span className="block text-xs text-muted">
                        {formatPay(job.pay, job.country, lang)} ·{" "}
                        {placeName(regionById(job.country, job.regionId), lang) ?? t.featured.auckland}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href={jobsHref("")} className="mt-3 inline-block text-brand underline underline-offset-2">
                {t.featured.browseAll}
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
  return <WindowNotices jobs={jobs} employers={await employersOf(jobs)} lang={await serverLang()} />;
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
  const lang = await serverLang();
  const t = await messages(seekerHomeMessages);
  const [open, by, ...more] = heroCounts(jobs.length, verified, stats, lang);
  const figure = (n: number) => <b className="font-figure text-[1.375rem] text-foreground">{formatCount(n, lang)}</b>;
  // #345: a Chinese part stays whole (a Chinese line may break between any two characters). An English label can be
  // wider than a 320 px screen, so there the part may wrap, and only the dot and the figure keep to the label's first
  // word (no-break spaces).
  const whole = lang === "zh" ? "whitespace-nowrap" : undefined;
  const glue = lang === "zh" ? " " : "\u00a0";
  return (
    <p data-hero-counts="" className="mt-4 text-body text-muted">
      <span className={whole}>
        {figure(open.value)}
        {glue}
        {open.label} {figure(by.value)}
        {glue}
        {by.label}
      </span>
      {more.map((part) => (
        // The space between parts is outside the unbreakable part, so the line can wrap there.
        <Fragment key={part.label}>
          {" "}
          <span className={whole}>
            ·{glue}
            {figure(part.value)}
            {glue}
            {part.label}
          </span>
        </Fragment>
      ))}
      {DEMO_DATA && (
        <span className="ml-2 inline-block rounded-sm bg-warn-soft px-1.5 py-0.5 text-meta whitespace-nowrap text-warn">
          {t.demoData}
        </span>
      )}
    </p>
  );
}

/**
 * 最新职位 (feedback 8): verified employers' open jobs in the job list's order, leaving out the window notices' ones
 * (latestVerifiedJobs). Without `now`, for the prerendered no-JavaScript summary, closing dates are not checked, as
 * before.
 */
async function latestJobs(limit: number, now?: number): Promise<Job[]> {
  if (now === undefined) {
    const [verified, notices] = await Promise.all([
      listFeaturedJobs(DEFAULT_COUNTRY, Infinity),
      listFeaturedJobs(DEFAULT_COUNTRY, NOTICE_COUNT),
    ]);
    return latestVerifiedJobs(newestFirst(verified), new Set(verified.map((j) => j.employerId)), notices, limit);
  }
  const [jobs, employers, notices] = await Promise.all([
    listJobs({ country: DEFAULT_COUNTRY }, now),
    listEmployers(),
    listFeaturedJobs(DEFAULT_COUNTRY, NOTICE_COUNT, now),
  ]);
  const verified = new Set(employers.filter((e) => e.verification !== "unverified").map((e) => e.id));
  return latestVerifiedJobs(jobs, verified, notices, limit);
}

async function LatestBand() {
  await connection(); // the latest jobs change as jobs are published
  const now = await requestTime();
  const jobs = await latestJobs(LATEST_COUNT, now);
  const [employers, activities] = await Promise.all([
    employersOf(jobs),
    employerActivities(
      jobs.map((job) => job.employerId),
      now,
    ),
  ]);
  const lang = await serverLang();
  const t = (await messages(seekerHomeMessages)).featured;
  return (
    <section id="featured" aria-labelledby="featured-heading" className={`${FULL_BLEED} scroll-mt-16`}>
      <div className={`${SITE_CONTAINER} py-12 lg:py-16`}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="featured-heading" className="text-2xl font-bold">
              {t.title}
            </h2>
            <p className="mt-1 text-body text-muted">{t.hint}</p>
          </div>
          <div className="flex flex-wrap gap-x-5">
            <a
              href={jobsHref("sort=recommended")}
              rel="nofollow"
              className="pressable inline-flex min-h-11 items-center font-medium text-brand"
            >
              {t.recommended}
            </a>
            <Link href={jobsHref("")} className="pressable inline-flex min-h-11 items-center font-medium text-brand">
              {t.all}
            </Link>
          </div>
        </div>
        <ul className="mt-6 space-y-3 lg:max-w-3xl">
          {jobs.map((job) => (
            <li key={job.id}>
              <JobCard
                look="app"
                job={job}
                employer={employers.get(job.employerId)}
                activity={activities.get(job.employerId)}
                headingLevel={3}
                demo={demoDataWanted()}
                lang={lang}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * While the window notices come (#167): two notice-sized grey cards where they will be, the same height as the
 * notices, so nothing below moves. Hidden without JavaScript, where the streamed notices show instead (#13).
 */
function NoticesSkeleton() {
  return (
    <div data-nojs-hide="" aria-hidden="true" className="flex h-72 gap-4 overflow-hidden pt-3 lg:h-[26rem] lg:pt-8">
      {[0, 1].map((i) => (
        <div key={i} className="w-[15rem] shrink-0 space-y-3 rounded-card bg-surface p-4 shadow-card lg:h-64">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}

/** While 最新职位 comes (#167): its heading and three job cards in grey, like the job list's loading page. */
async function LatestSkeleton() {
  const t = (await messages(seekerHomeMessages)).featured;
  return (
    <div data-nojs-hide="" className={FULL_BLEED}>
      <div className={`${SITE_CONTAINER} py-12 lg:py-16`}>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-2 h-4 w-64 max-w-full" />
        <div className="mt-6 lg:max-w-3xl">
          <SkeletonList count={3} label={t.loading} />
        </div>
      </div>
    </div>
  );
}

/** 功能展示: three features, after the latest jobs (feedback 8; the AI chat post is in the employer band). */
async function FeaturesBand() {
  const lang = await serverLang();
  const t = await messages(seekerHomeMessages);
  return (
    <section aria-labelledby="features-heading" className={`${FULL_BLEED} bg-background`}>
      <div className={`${SITE_CONTAINER} py-12 lg:py-16`}>
        <h2 id="features-heading" className="text-2xl font-bold">
          {t.features.title}
        </h2>
        {/* Visual A (V2): the features open nothing, so they are one sheet split by lines, not cards. */}
        <ul
          className={`mt-8 divide-y divide-border lg:grid lg:grid-cols-3 lg:divide-x lg:divide-y-0 ${sheetClass({ padded: false })}`}
        >
          {features(lang).map((feature) => (
            <li key={feature.title} className="flex items-start gap-3 p-4 lg:p-5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand">
                <FeatureIconSvg name={feature.icon} />
              </span>
              <div>
                <h3 className="font-semibold">{feature.title}</h3>
                <p className="mt-1 text-body leading-relaxed text-muted">{feature.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * For employers: a WeChat message turned into a job by the same parser the post flow uses, then the AI chat post
 * with a replay of a real conversation (feedback 8: moved here from 功能展示).
 */
async function EmployerBand() {
  const [{ draft }, replay, lang] = await Promise.all([
    parsePost(EMPLOYER_EXAMPLE, DEFAULT_COUNTRY),
    buildReplay(),
    serverLang(),
  ]);
  const ai = aiFeature(lang);
  const t = (await messages(seekerHomeMessages)).employers;
  return (
    <section aria-labelledby="employer-heading" className={`${FULL_BLEED} bg-foreground text-white`}>
      <div
        className={`${SITE_CONTAINER} grid items-center gap-10 py-12 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:py-16`}
      >
        <div>
          <p className="text-body text-white/75">{t.eyebrow}</p>
          <h2 id="employer-heading" className="mt-1 text-2xl font-bold">
            {t.title}
          </h2>
          <ul className="mt-4 space-y-2 text-body text-white/90">
            {EMPLOYER_POINTS.map((point) => (
              <li key={point} className="flex items-start gap-2">
                <CheckIcon className="mt-0.5 size-4" />
                {t[point]}
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            <PostJobLink className="pressable inline-flex min-h-12 items-center rounded-control bg-white px-5 font-semibold text-foreground hover:bg-white/90">
              {t.signUp}
            </PostJobLink>
            <Link
              href="/employer"
              className="pressable inline-flex min-h-11 items-center text-body text-white underline underline-offset-4 hover:no-underline"
            >
              {t.whatTheyCanDo}
            </Link>
          </div>
        </div>
        <BeforeAfter
          message={EMPLOYER_EXAMPLE}
          draft={draft}
          summaryEn={englishSummary(draft, DEFAULT_COUNTRY)}
          lang={lang}
        />
        <article aria-labelledby="ai-feature-heading" className={`text-foreground lg:col-span-2 ${sheetClass()}`}>
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-control bg-brand text-white">
              <FeatureIconSvg name="chat" />
            </span>
            <div>
              <h3 id="ai-feature-heading" className="font-semibold">
                {ai.title}
              </h3>
              <p className="mt-1 text-body leading-relaxed text-muted">{ai.text}</p>
            </div>
          </div>
          <div className="mt-4">
            <ChatReplay messages={replay} />
          </div>
        </article>
      </div>
    </section>
  );
}

/** Links shared before the list moved to /jobs (/?industry=…) still open that filtered list. */
async function LegacyListLink({ searchParams }: Pick<PageProps<"/[lang]">, "searchParams">) {
  const query = filterToQuery(parseFilter(await searchParams, DEFAULT_COUNTRY));
  if (query) redirect(jobsHref(query));
  return null;
}
