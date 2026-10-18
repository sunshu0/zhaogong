"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getMyJobDays } from "@/app/[lang]/employer/actions";
import type { JobDay } from "@/db/job-stats";
import type { ApplicationFunnel } from "@/db/job-applications";
import type { Job } from "@/lib/types";
import { EmployerGate, type EmployerIdentity } from "@/components/employer/EmployerGate";
import { Section } from "@/components/ui/Section";
import { BACK_LINK } from "@/components/employer/app-style";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useLang, useMessages } from "@/i18n/client";
import { formatDate } from "@/i18n/format";
import { contentLang, type Lang } from "@/i18n/lang";
import { employerJobsMessages } from "@/i18n/messages/employer-jobs";

const SHORT_DAY: Intl.DateTimeFormatOptions = {
  timeZone: "UTC",
  month: "numeric",
  day: "numeric",
  weekday: "short",
};

/** 「10/16周五」 for a YYYY-MM-DD day (already a New Zealand day, so read it as UTC to keep it as is). */
function dayLabel(day: string, lang: Lang): string {
  return formatDate(`${day}T00:00:00Z`, lang, SHORT_DAY);
}

/** 职位数据 (#55, R-31): one of the business's jobs, day by day for the last 14 days. */
export function JobStats({ jobId }: { jobId: string }) {
  return <EmployerGate next={`/employer/jobs/${jobId}/stats`}>{(me) => <Stats jobId={jobId} me={me} />}</EmployerGate>;
}

function Stats({ jobId, me }: { jobId: string; me: EmployerIdentity }) {
  const lang = useLang();
  const t = useMessages(employerJobsMessages).stats;
  const [loaded, setLoaded] = useState<{
    email: string;
    data: { job: Job; days: JobDay[]; funnel: ApplicationFunnel } | null;
  }>();

  useEffect(() => {
    let live = true;
    getMyJobDays(jobId).then((data) => {
      if (live) setLoaded({ email: me.email, data });
    });
    return () => {
      live = false;
    };
  }, [jobId, me.email]);

  if (loaded?.email !== me.email) return <SkeletonList count={2} />;
  if (!loaded.data) {
    return (
      <div className="rounded-card bg-surface px-4 py-8 shadow-card text-center text-body text-muted">
        {t.notFound}
        <Link href="/employer/jobs" className="mt-3 block text-brand underline">
          {t.backToManage}
        </Link>
      </div>
    );
  }

  const { job, days, funnel } = loaded.data;
  const total = (key: "views" | "chats" | "contactViews") => days.reduce((sum, d) => sum + d[key], 0);
  const most = Math.max(1, ...days.map((d) => d.views));

  return (
    <div className="space-y-section">
      <div>
        <Link href="/employer/jobs" className={BACK_LINK}>
          {t.back}
        </Link>
        <h1 className="mt-1 text-title font-semibold">{t.heading}</h1>
        <p className="text-body text-muted">
          <span lang={contentLang(job.titleZh)}>{job.titleZh}</span>
          {t.subtitleRest}
        </p>
      </div>

      <Section look="app">
        <dl className="grid grid-cols-3 gap-3 py-group text-center">
          {(
            [
              [t.totals.views, total("views")],
              [t.totals.chats, total("chats")],
              [t.totals.contactViews, job.contactPublic ? total("contactViews") : null],
            ] as const
          ).map(([label, n]) => (
            <div key={label}>
              <dt className="text-meta text-muted">{label}</dt>
              <dd className="font-figure text-title">{n ?? "—"}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section look="app" title={t.funnelTitle} description={t.funnelDescription}>
        <dl aria-label={t.funnelTitle} className="grid grid-cols-3 gap-3 py-group text-center">
          {(
            [
              [t.funnel.applied, funnel.applied],
              [t.funnel.interviewed, funnel.interviewed],
              [t.funnel.hired, funnel.hired],
            ] as const
          ).map(([label, n]) => (
            <div key={label}>
              <dt className="text-meta text-muted">{label}</dt>
              <dd className="font-figure text-title">{n}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section look="app" title={t.byDayTitle} description={t.byDayDescription}>
        <table className="w-full text-body">
          <caption className="sr-only">{t.tableCaption}</caption>
          <thead>
            <tr className="border-b border-border text-left text-meta text-muted">
              <th scope="col" className="py-2 font-normal">
                {t.columns.day}
              </th>
              <th scope="col" className="py-2 font-normal">
                {t.columns.views}
              </th>
              <th scope="col" className="py-2 text-right font-normal">
                {t.columns.chats}
              </th>
              <th scope="col" className="py-2 text-right font-normal">
                {t.columns.contact}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {[...days].reverse().map((d) => (
              <tr key={d.day}>
                <th scope="row" className="py-2 text-left font-normal whitespace-nowrap">
                  {dayLabel(d.day, lang)}
                </th>
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 text-right font-figure">{d.views}</span>
                    <span
                      aria-hidden
                      className="h-2 rounded-sm bg-brand/60"
                      style={{ width: `${(d.views / most) * 100}%`, maxWidth: "6rem" }}
                    />
                  </div>
                </td>
                <td className="py-2 text-right font-figure">{d.chats}</td>
                <td className="py-2 text-right font-figure">{job.contactPublic ? d.contactViews : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!job.contactPublic && <p className="pb-group text-meta text-muted">{t.contactPrivateNote}</p>}
      </Section>
    </div>
  );
}
