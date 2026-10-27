// 实习 and 专业职位 (#113, ADR 0014): external jobs a moderator approved, read from companies' public job feeds.
// Facts only, with where they come from and when they were read; applying happens on the company's own site.
// Server components: the list and its filter form work without JavaScript (a GET form). 收藏 and 保存为提醒 (#131) are
// the job list's buttons, keyed for external jobs.
import Link from "next/link";
import { Suspense } from "react";
import { requestTime } from "@/components/seeker/request-time";
import { listExternalJobs, type ExternalJob } from "@/db/external-jobs";
import {
  filterExternalJobs,
  isExternalFiltered,
  parseExternalFilter,
  SECTION_KINDS,
  SECTION_PATHS,
  type ExternalFilter,
  type ExternalSection,
} from "@/lib/external-jobs/filter";
import { externalWords, payLabel, sourceLine } from "@/lib/external-jobs/labels";
import { SoftTag } from "@/components/ui/Tag";
import { Button } from "@/components/ui/Button";
import { linkCardClass, sheetClass } from "@/components/ui/Card";
import { SkeletonList } from "@/components/ui/Skeleton";
import { TakedownNote } from "@/components/external/TakedownNote";
import { NoScriptStreams } from "@/components/seeker/NoScriptStreams";
import { TrackView } from "@/components/ui/TrackView";
import { Checkbox } from "@/components/ui/Checkbox";
import { Select, type SelectOption } from "@/components/ui/Select";
import { FinishSaveAfterSignIn, SaveJobButton } from "@/components/seeker/SaveJobButton";
import { SaveAlert } from "@/components/seeker/SaveAlert";
import { externalSaveKey } from "@/components/seeker/saved-jobs";
import { externalFilterToQuery } from "@/lib/external-jobs/alerts";
import { FORWARD, PageTransition } from "@/components/ui/PageTransition";
import { formatDate } from "@/i18n/format";
import type { Lang } from "@/i18n/lang";
import { serverLang } from "@/i18n/server";
import { ListPlace } from "@/components/seeker/list-place";

type Query = Record<string, string | string[] | undefined>;
/** The external dictionary in the page's language. */
type Words = ReturnType<typeof externalWords>;

const sectionTitle = (w: Words, section: ExternalSection) => w.sections[section];

export async function ExternalSectionPage({
  section,
  searchParams,
}: {
  section: ExternalSection;
  searchParams: Promise<Query>;
}) {
  const other: ExternalSection = section === "internship" ? "professional" : "internship";
  const w = externalWords(await serverLang());
  const t = w.list;
  return (
    <PageTransition>
      <div className="type-app space-y-4">
        <div className="space-y-1">
          <h1 className="text-title font-semibold">{sectionTitle(w, section)}</h1>
          <p className="text-body text-muted">
            {section === "internship" ? w.sections.internshipIntro : w.sections.professionalIntro}
            {t.introBefore}
            <strong className="font-medium text-foreground">{t.introStrong}</strong>
            {t.introAfter}{" "}
            <Link href={SECTION_PATHS[other]} className="text-brand underline underline-offset-2">
              {sectionTitle(w, other)}
            </Link>
            {t.introAnd}
            <Link href="/jobs" className="text-brand underline underline-offset-2">
              {t.ordinaryJobs}
            </Link>
            {t.introEnd}
          </p>
        </div>
        {/* Without JavaScript the streamed list (and loading.tsx's skeleton) would stay hidden (#13). */}
        <NoScriptStreams />
        <FinishSaveAfterSignIn />
        <TrackView event={{ name: "external_list_view", path: SECTION_PATHS[section], detail: section }} />
        <Suspense
          fallback={
            <div data-nojs-hide="">
              <SkeletonList label={t.loading} />
            </div>
          }
        >
          <Results section={section} searchParams={searchParams} />
        </Suspense>
        <TakedownNote />
      </div>
    </PageTransition>
  );
}

async function Results({ section, searchParams }: { section: ExternalSection; searchParams: Promise<Query> }) {
  const filter = parseExternalFilter(await searchParams, section);
  const lang = await serverLang();
  const w = externalWords(lang);
  const t = w.list;
  const now = await requestTime();
  const shown = (await listExternalJobs({ shownAt: new Date(now) })).sort(
    (a, b) => (b.postedAt ?? b.firstSeenAt).localeCompare(a.postedAt ?? a.firstSeenAt) || a.id.localeCompare(b.id),
  );
  const all = filterExternalJobs(shown, section, {});
  const jobs = filterExternalJobs(shown, section, filter);
  const filtered = isExternalFiltered(filter);
  return (
    <div className="space-y-3 lg:grid lg:grid-cols-[16rem_minmax(0,48rem)] lg:items-start lg:gap-x-10 lg:space-y-0">
      {/* Keyed by the filter: a link to the same list with other filters starts the form afresh. */}
      <FilterForm key={externalFilterToQuery(filter)} section={section} filter={filter} w={w} />
      <section aria-label={t.listLabel(sectionTitle(w, section))} className="space-y-3">
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3">
          <p className="text-body text-muted">{filtered ? t.found(jobs.length, all.length) : t.total(all.length)}</p>
          <SaveAlert key={externalFilterToQuery(filter)} query={externalFilterToQuery(filter)} section={section} />
        </div>
        {jobs.length === 0 ? (
          <div className={`space-y-2 text-body ${sheetClass()}`}>
            <p>{filtered ? t.noMatch : t.none}</p>
            {filtered && (
              <Link href={SECTION_PATHS[section]} className="text-brand underline underline-offset-2">
                {t.clear}
              </Link>
            )}
          </div>
        ) : (
          // 「← 返回」 from a job lands where the user was (#409).
          <ListPlace>
            <ul className="space-y-3">
              {jobs.map((job) => (
                <li key={job.id}>
                  <ExternalJobRow job={job} lang={lang} w={w} />
                </li>
              ))}
            </ul>
          </ListPlace>
        )}
      </section>
    </div>
  );
}

export const externalJobHref = (id: string) => `/external/${encodeURIComponent(id)}`;

function ExternalJobRow({ job, lang, w }: { job: ExternalJob; lang: Lang; w: Words }) {
  const t = w.list;
  const closes = job.closesAt
    ? t.closes(
        formatDate(
          job.closesAt,
          lang,
          lang === "en" ? { day: "numeric", month: "short" } : { month: "numeric", day: "numeric" },
        ),
      )
    : t.closesNotStated(w.notStated);
  return (
    // Round 19: a card like the job list's; the title's link opens it from anywhere on the card.
    <article aria-labelledby={`x-${job.id}`} className={linkCardClass()}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`x-${job.id}`} lang="en" className="text-subtitle font-semibold break-words group-hover:text-brand">
            <Link
              href={externalJobHref(job.id)}
              transitionTypes={FORWARD}
              className="outline-none after:absolute after:inset-0"
            >
              {job.title}
            </Link>
          </h2>
          <p className="truncate text-body">
            <span lang="en">{job.companyName}</span> · {w.cities[job.city]}
          </p>
        </div>
        <SaveJobButton jobId={externalSaveKey(job.id)} title={job.title} />
      </div>
      <p className="mt-2 text-body text-muted">
        {closes}
        {job.pay && ` · ${payLabel(job.pay, lang)}`}
      </p>
      <ul aria-label={t.tags} className="mt-2 flex flex-wrap gap-1.5">
        <li>
          <SoftTag tone="neutral">{w.name}</SoftTag>
        </li>
        <li>
          <SoftTag tone="brand">{w.fields[job.field]}</SoftTag>
        </li>
        <li>
          <SoftTag tone="neutral">{job.kind ? w.kinds[job.kind] : t.kindNotStated(w.notStated)}</SoftTag>
        </li>
      </ul>
      <p className="mt-2 text-meta text-muted">{sourceLine(job.companyName, job.lastSeenAt, lang)}</p>
    </article>
  );
}

function FilterForm({ section, filter, w }: { section: ExternalSection; filter: ExternalFilter; w: Words }) {
  const t = w.filter;
  const options = (entries: [string, string][]): SelectOption[] => entries.map(([value, label]) => ({ value, label }));
  return (
    <form
      action={SECTION_PATHS[section]}
      aria-label={t.label}
      className="grid grid-cols-2 gap-3 rounded-card bg-surface p-3 shadow-card lg:grid-cols-1 lg:p-4"
    >
      <Select name="field" label={t.field} defaultValue={filter.field} options={options(Object.entries(w.fields))} />
      <Select
        name="kind"
        label={t.kind}
        defaultValue={filter.kind}
        options={options([
          ...SECTION_KINDS[section].map((k): [string, string] => [k, w.kinds[k]]),
          ...(section === "professional" ? [["unstated", w.notStated] as [string, string]] : []),
        ])}
      />
      <Select
        name="experience"
        label={t.experience}
        defaultValue={filter.experience}
        options={options(Object.entries(t.experienceOptions))}
      />
      <Select name="visa" label={t.visa} defaultValue={filter.visa} options={options(Object.entries(t.visaOptions))} />
      <Select name="city" label={t.area} defaultValue={filter.city} options={options(Object.entries(w.cities))} />
      <div className="self-end">
        <Checkbox name="paid" value="1" defaultChecked={filter.paid}>
          {t.withPay}
        </Checkbox>
      </div>
      <Button type="submit" size="lg" className="col-span-2 lg:col-span-1">
        {t.submit}
      </Button>
    </form>
  );
}
