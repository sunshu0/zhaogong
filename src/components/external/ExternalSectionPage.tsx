// 实习 and 专业职位 (#113, ADR 0014): external jobs a moderator approved, read from companies' public job feeds.
// Facts only, with where they come from and when they were read; applying happens on the company's own site.
// Server components: the list and its filter form work without JavaScript (a GET form).
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
import { Tag } from "@/components/ui/Tag";
import { TakedownNote } from "@/components/external/TakedownNote";

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
    <div className="space-y-4">
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
      <Suspense fallback={<div className="h-60 animate-pulse rounded-md bg-surface" />}>
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
    <div className="space-y-3 lg:grid lg:grid-cols-[15rem_minmax(0,45rem)] lg:items-start lg:gap-x-10 lg:space-y-0">
      <FilterForm section={section} filter={filter} />
      <section aria-label={`${SECTION_TITLES[section]}列表`} className="space-y-3">
        <p className="text-body text-muted">
          {filtered ? `找到 ${jobs.length} 个，共 ${all.length} 个` : `共 ${all.length} 个，最新发布在前`}
        </p>
        {jobs.length === 0 ? (
          <div className="space-y-2 rounded-md border border-border bg-surface p-4 text-body">
            <p>{filtered ? "没有符合这些条件的职位。" : "现在还没有职位。"}</p>
            {filtered && (
              <Link href={SECTION_PATHS[section]} className="text-brand underline underline-offset-2">
                清除筛选
              </Link>
            )}
          </div>
        ) : (
          <ul className="-mx-4 divide-y divide-border border-y border-border bg-surface sm:mx-0 sm:rounded-md sm:border">
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
    <article aria-labelledby={`x-${job.id}`} className="space-y-1.5 px-4 py-3 sm:px-5">
      <h2 id={`x-${job.id}`} lang="en" className="text-subtitle font-semibold">
        <Link href={externalJobHref(job.id)} className="hover:text-brand">
          {job.title}
        </Link>
      </h2>
      <p className="text-body">
        <span lang="en">{job.companyName}</span> · {CITY_LABELS[job.city]}
      </p>
      <p className="flex flex-wrap gap-1.5">
        <Tag kind="neutral">外部职位</Tag>
        <Tag kind="perk">{FIELD_LABELS[job.field]}</Tag>
        <Tag kind="neutral">{job.kind ? KIND_LABELS[job.kind] : `类型：${NOT_STATED}`}</Tag>
      </p>
      <p className="text-meta text-muted">
        {closes}
        {job.pay && ` · ${payLabel(job.pay)}`}
      </p>
      <p className="text-meta text-muted">{sourceLine(job.companyName, job.lastSeenAt)}</p>
    </article>
  );
}

function Select({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value?: string;
  options: [string, string][];
}) {
  return (
    <label className="block space-y-1 text-body">
      <span className="text-meta text-muted">{label}</span>
      <select
        name={name}
        defaultValue={value ?? ""}
        className="h-10 w-full rounded-md border border-border bg-surface px-2 text-body"
      >
        <option value="">不限</option>
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterForm({ section, filter }: { section: ExternalSection; filter: ExternalFilter }) {
  return (
    <form
      action={SECTION_PATHS[section]}
      aria-label="筛选"
      className="grid grid-cols-2 gap-3 rounded-md border border-border bg-surface p-3 lg:grid-cols-1"
    >
      <Select
        name="field"
        label="领域"
        value={filter.field}
        options={Object.entries(FIELD_LABELS) as [string, string][]}
      />
      <Select
        name="kind"
        label="类型"
        value={filter.kind}
        options={[
          ...SECTION_KINDS[section].map((k): [string, string] => [k, KIND_LABELS[k]]),
          ...(section === "professional" ? [["unstated", NOT_STATED] as [string, string]] : []),
        ]}
      />
      <Select
        name="experience"
        label="经验要求"
        value={filter.experience}
        options={Object.entries(EXPERIENCE_OPTIONS)}
      />
      <Select name="visa" label="签证" value={filter.visa} options={Object.entries(VISA_OPTIONS)} />
      <Select
        name="city"
        label="地区"
        value={filter.city}
        options={Object.entries(CITY_LABELS) as [string, string][]}
      />
      <label className="flex items-center gap-2 self-end pb-2 text-body">
        <input type="checkbox" name="paid" value="1" defaultChecked={filter.paid} className="accent-brand" />
        只看写了薪资的
      </label>
      <button
        type="submit"
        className="col-span-2 h-10 rounded-md bg-brand px-4 text-body font-medium text-white lg:col-span-1"
      >
        筛选
      </button>
    </form>
  );
}
