import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DEFAULT_COUNTRY } from "@/config/countries";
import { PRODUCT_NAME } from "@/i18n/labels";
import { getEmployer, listJobs } from "@/lib/data";
import { filterToQuery, jobsHref, parseFilter } from "@/components/seeker/filter-query";
import { JobCard } from "@/components/seeker/JobCard";
import { requestTime } from "@/components/seeker/request-time";

const TITLE = `${PRODUCT_NAME} · 奥克兰的中文工作平台`;
const DESCRIPTION = "时薪、地区、签证一目了然；雇主经过验证，职位发布前检查最低工资和违规收费；登录后才显示联系方式。";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", locale: "zh_CN" },
};

const SEEKER_POINTS = [
  { title: "时薪、地区、签证一目了然", text: "每个职位都写明时薪、工作地区，以及雇主接受哪些签证。" },
  { title: "雇主验证，发布前查违规", text: "核对过企业登记的雇主带有认证标志；职位发布前会检查是否低于最低工资、有没有押金或介绍费。" },
  { title: "登录后才显示联系方式", text: "电话和微信只给登录的人看，减少信息被乱抓；遇到收费或可疑职位，可以直接举报。" },
];

const EMPLOYER_POINTS = [
  "粘贴微信群里的招聘消息，自动整理成中英文职位",
  "发布前自动检查最低工资和违规用词",
  "一键复制到微信群、小红书和 Skykiwi",
];

const TEASER_SIZE = 3;

/** The intro page: what we are, for job seekers first, then a smaller part for employers. */
export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <LegacyListLink searchParams={searchParams} />
      </Suspense>

      <section className="rounded-2xl bg-brand-soft px-5 py-7">
        <h1 className="text-2xl leading-snug font-semibold">奥克兰的中文工作平台</h1>
        <p className="mt-2 text-sm text-muted">餐饮、零售、清洁、装修等工作，时薪写清楚，联系雇主更放心。</p>
        <div className="mt-5 flex gap-3">
          <Link
            href={`/login?next=${encodeURIComponent(jobsHref(""))}`}
            className="flex-1 rounded-lg bg-brand px-4 py-2.5 text-center text-sm font-medium text-white"
          >
            注册
          </Link>
          <Link
            href={jobsHref("")}
            className="flex-1 rounded-lg border border-brand bg-surface px-4 py-2.5 text-center text-sm font-medium text-brand"
          >
            直接浏览工作
          </Link>
        </div>
      </section>

      <section aria-labelledby="why-heading">
        <h2 id="why-heading" className="sr-only">
          为什么用{PRODUCT_NAME}
        </h2>
        <ul className="grid gap-3 md:grid-cols-3">
          {SEEKER_POINTS.map((point) => (
            <li key={point.title} className="rounded-xl border border-border bg-surface p-4">
              <p className="flex items-start gap-2 font-medium">
                <Check />
                {point.title}
              </p>
              <p className="mt-1 text-sm text-muted">{point.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl border border-border bg-surface" />}>
        <NewestJobs />
      </Suspense>

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
        <Link href="/employer" className="mt-3 inline-block rounded-lg border border-border px-4 py-2 text-sm hover:border-brand hover:text-brand">
          雇主发布招聘 →
        </Link>
      </section>
    </div>
  );
}

async function NewestJobs() {
  const now = await requestTime();
  const jobs = await listJobs({ country: DEFAULT_COUNTRY });
  const newest = jobs.slice(0, TEASER_SIZE);
  const employers = await Promise.all(newest.map((job) => getEmployer(job.employerId)));
  return (
    <section aria-labelledby="newest-heading">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="newest-heading" className="font-medium">
          最新职位
        </h2>
        <Link href={jobsHref("")} className="text-sm text-brand">
          查看全部 {jobs.length} 个职位 →
        </Link>
      </div>
      <ul className="space-y-3">
        {newest.map((job, i) => (
          <li key={job.id}>
            <JobCard job={job} employer={employers[i]} now={now} />
          </li>
        ))}
      </ul>
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
