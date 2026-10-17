// 实习 and 专业职位 (#113, ADR 0014): external jobs a moderator approved, read from companies' public job feeds.
// Facts only, with where they come from and when they were read; applying happens on the company's own site.
// Server components: the list and its filter form work without JavaScript (a GET form). 收藏 and 保存为提醒 (#131) are
// the job list's buttons, keyed for external jobs.
import Link from "next/link";
import { Suspense } from "react";
import { requestTime } from "@/components/seeker/request-time";
import { listExternalJobs, type ExternalJob } from "@/db/external-jobs";
import {
  EXPERIENCE_OPTIONS,
  filterExternalJobs,
  isExternalFiltered,
  parseExternalFilter,
  SECTION_KINDS,
  SECTION_PATHS,
  SECTION_TITLES,
  VISA_OPTIONS,
  type ExternalFilter,
  type ExternalSection,
} from "@/lib/external-jobs/filter";
import { CITY_LABELS, FIELD_LABELS, KIND_LABELS, NOT_STATED, payLabel, sourceLine } from "@/lib/external-jobs/labels";
import { SoftTag } from "@/components/ui/Tag";
import { Button } from "@/components/ui/Button";
import { cardClass, linkCardClass } from "@/components/ui/Card";
import { SkeletonList } from "@/components/ui/Skeleton";
import { TakedownNote } from "@/components/external/TakedownNote";
import { NoScriptStreams } from "@/components/seeker/NoScriptStreams";
import { Checkbox } from "@/components/ui/Checkbox";
import { Select, type SelectOption } from "@/components/ui/Select";
import { FinishSaveAfterSignIn, SaveJobButton } from "@/components/seeker/SaveJobButton";
import { SaveAlert } from "@/components/seeker/SaveAlert";
import { externalSaveKey } from "@/components/seeker/saved-jobs";
import { externalFilterToQuery } from "@/lib/external-jobs/alerts";

type Query = Record<string, string | string[] | undefined>;

const INTRO: Record<ExternalSection, string> = {
  internship: "软件和电子电气领域的实习、毕业生项目，来自公司官网。",
  professional: "软件和电子电气领域的全职、合同岗位，来自公司官网。",
};

export function ExternalSectionPage({
  section,
  searchParams,
}: {
  section: ExternalSection;
  searchParams: Promise<Query>;
}) {
  const other: ExternalSection = section === "internship" ? "professional" : "internship";
  return (
    <div className="type-app space-y-4">
      <div className="space-y-1">
        <h1 className="text-title font-semibold">{SECTION_TITLES[section]}</h1>
        <p className="text-body text-muted">
          {INTRO[section]}这些是<strong className="font-medium text-foreground">外部职位</strong>
          ：不是雇主在找工发布的，我们只整理事实，申请请到公司官网。也看看{" "}
          <Link href={SECTION_PATHS[other]} className="text-brand underline underline-offset-2">
            {SECTION_TITLES[other]}
          </Link>
          、
          <Link href="/jobs" className="text-brand underline underline-offset-2">
            普通工作
          </Link>
          。
        </p>
      </div>
      {/* Without JavaScript the streamed list (and loading.tsx's skeleton) would stay hidden (#13). */}
      <NoScriptStreams />
      <FinishSaveAfterSignIn />
      <Suspense
        fallback={
          <div data-nojs-hide="">
            <SkeletonList label="正在加载职位" />
          </div>
        }
      >
        <Results section={section} searchParams={searchParams} />
      </Suspense>
      <TakedownNote />
    </div>
  );
}

async function Results({ section, searchParams }: { section: ExternalSection; searchParams: Promise<Query> }) {
  const filter = parseExternalFilter(await searchParams, section);
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
      <FilterForm key={externalFilterToQuery(filter)} section={section} filter={filter} />
      <section aria-label={`${SECTION_TITLES[section]}列表`} className="space-y-3">
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3">
          <p className="text-body text-muted">
            {filtered ? `找到 ${jobs.length} 个，共 ${all.length} 个` : `共 ${all.length} 个，最新发布在前`}
          </p>
          <SaveAlert key={externalFilterToQuery(filter)} query={externalFilterToQuery(filter)} section={section} />
        </div>
        {jobs.length === 0 ? (
          <div className={`space-y-2 text-body ${cardClass()}`}>
            <p>{filtered ? "没有符合这些条件的职位。" : "现在还没有职位。"}</p>
            {filtered && (
              <Link href={SECTION_PATHS[section]} className="text-brand underline underline-offset-2">
                清除筛选
              </Link>
            )}
          </div>
        ) : (
          <ul className="space-y-3">
            {jobs.map((job) => (
              <li key={job.id}>
                <ExternalJobRow job={job} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export const externalJobHref = (id: string) => `/external/${encodeURIComponent(id)}`;

function ExternalJobRow({ job }: { job: ExternalJob }) {
  const closes = job.closesAt
    ? `截止 ${new Intl.DateTimeFormat("zh-CN", { timeZone: "Pacific/Auckland", month: "numeric", day: "numeric" }).format(new Date(job.closesAt))}`
    : `截止日期：${NOT_STATED}`;
  return (
    // Round 19: a card like the job list's; the title's link opens it from anywhere on the card.
    <article aria-labelledby={`x-${job.id}`} className={linkCardClass()}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`x-${job.id}`} lang="en" className="text-subtitle font-semibold break-words group-hover:text-brand">
            <Link href={externalJobHref(job.id)} className="outline-none after:absolute after:inset-0">
              {job.title}
            </Link>
          </h2>
          <p className="truncate text-body">
            <span lang="en">{job.companyName}</span> · {CITY_LABELS[job.city]}
          </p>
        </div>
        <SaveJobButton jobId={externalSaveKey(job.id)} title={job.title} />
      </div>
      <p className="mt-2 text-body text-muted">
        {closes}
        {job.pay && ` · ${payLabel(job.pay)}`}
      </p>
      <ul aria-label="标签" className="mt-2 flex flex-wrap gap-1.5">
        <li>
          <SoftTag tone="neutral">外部职位</SoftTag>
        </li>
        <li>
          <SoftTag tone="brand">{FIELD_LABELS[job.field]}</SoftTag>
        </li>
        <li>
          <SoftTag tone="neutral">{job.kind ? KIND_LABELS[job.kind] : `类型：${NOT_STATED}`}</SoftTag>
        </li>
      </ul>
      <p className="mt-2 text-meta text-muted">{sourceLine(job.companyName, job.lastSeenAt)}</p>
    </article>
  );
}

function FilterForm({ section, filter }: { section: ExternalSection; filter: ExternalFilter }) {
  const options = (entries: [string, string][]): SelectOption[] => entries.map(([value, label]) => ({ value, label }));
  return (
    <form
      action={SECTION_PATHS[section]}
      aria-label="筛选"
      className="grid grid-cols-2 gap-3 rounded-card bg-surface p-3 shadow-card lg:grid-cols-1 lg:p-4"
    >
      <Select
        name="field"
        label="领域"
        defaultValue={filter.field}
        options={options(Object.entries(FIELD_LABELS) as [string, string][])}
      />
      <Select
        name="kind"
        label="类型"
        defaultValue={filter.kind}
        options={options([
          ...SECTION_KINDS[section].map((k): [string, string] => [k, KIND_LABELS[k]]),
          ...(section === "professional" ? [["unstated", NOT_STATED] as [string, string]] : []),
        ])}
      />
      <Select
        name="experience"
        label="经验要求"
        defaultValue={filter.experience}
        options={options(Object.entries(EXPERIENCE_OPTIONS))}
      />
      <Select name="visa" label="签证" defaultValue={filter.visa} options={options(Object.entries(VISA_OPTIONS))} />
      <Select
        name="city"
        label="地区"
        defaultValue={filter.city}
        options={options(Object.entries(CITY_LABELS) as [string, string][])}
      />
      <div className="self-end">
        <Checkbox name="paid" value="1" defaultChecked={filter.paid}>
          只看写了薪资的
        </Checkbox>
      </div>
      <Button type="submit" size="lg" className="col-span-2 lg:col-span-1">
        筛选
      </Button>
    </form>
  );
}
