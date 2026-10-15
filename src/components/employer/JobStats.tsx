"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getMyJobDays } from "@/app/employer/actions";
import type { JobDay } from "@/db/job-stats";
import type { Job } from "@/lib/types";
import { EmployerGate, type EmployerIdentity } from "@/components/employer/EmployerGate";
import { Section } from "@/components/ui/Section";

const shortDay = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "UTC",
  month: "numeric",
  day: "numeric",
  weekday: "short",
});

/** 「10月16日周五」 for a YYYY-MM-DD day (already a New Zealand day, so read it as UTC to keep it as is). */
function dayLabel(day: string): string {
  return shortDay.format(new Date(`${day}T00:00:00Z`));
}

/** 职位数据 (#55, R-31): one of the business's jobs, day by day for the last 14 days. */
export function JobStats({ jobId }: { jobId: string }) {
  return <EmployerGate next={`/employer/jobs/${jobId}/stats`}>{(me) => <Stats jobId={jobId} me={me} />}</EmployerGate>;
}

function Stats({ jobId, me }: { jobId: string; me: EmployerIdentity }) {
  const [loaded, setLoaded] = useState<{ email: string; data: { job: Job; days: JobDay[] } | null }>();

  useEffect(() => {
    let live = true;
    getMyJobDays(jobId).then((data) => {
      if (live) setLoaded({ email: me.email, data });
    });
    return () => {
      live = false;
    };
  }, [jobId, me.email]);

  if (loaded?.email !== me.email)
    return <div className="h-40 animate-pulse rounded-md border border-border bg-surface" />;
  if (!loaded.data) {
    return (
      <div className="rounded-md border border-dashed border-border bg-surface px-4 py-8 text-center text-body text-muted">
        找不到这个职位，或者它不属于你登录的店铺。
        <Link href="/employer/jobs" className="mt-3 block text-brand underline">
          回到职位管理
        </Link>
      </div>
    );
  }

  const { job, days } = loaded.data;
  const total = (key: "views" | "chats" | "contactViews") => days.reduce((sum, d) => sum + d[key], 0);
  const most = Math.max(1, ...days.map((d) => d.views));

  return (
    <div className="space-y-section">
      <div>
        <Link href="/employer/jobs" className="text-meta text-brand underline-offset-4 hover:underline">
          ← 职位管理
        </Link>
        <h1 className="mt-1 text-title font-semibold">职位数据</h1>
        <p className="text-body text-muted">{job.titleZh} · 最近 14 天</p>
      </div>

      <Section>
        <dl className="grid grid-cols-3 gap-3 py-group text-center">
          {(
            [
              ["浏览", total("views")],
              ["发起聊天", total("chats")],
              ["查看联系方式", job.contactPublic ? total("contactViews") : null],
            ] as const
          ).map(([label, n]) => (
            <div key={label}>
              <dt className="text-meta text-muted">{label}</dt>
              <dd className="font-figure text-title">{n ?? "—"}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="按天" description="浏览：同一个浏览器一天只算一次。发起聊天：求职者第一次就这个职位发消息。">
        <table className="w-full text-body">
          <caption className="sr-only">最近 14 天每天的浏览、发起聊天和查看联系方式次数</caption>
          <thead>
            <tr className="border-b border-border text-left text-meta text-muted">
              <th scope="col" className="py-2 font-normal">
                日期
              </th>
              <th scope="col" className="py-2 font-normal">
                浏览
              </th>
              <th scope="col" className="py-2 text-right font-normal">
                聊天
              </th>
              <th scope="col" className="py-2 text-right font-normal">
                联系方式
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {[...days].reverse().map((d) => (
              <tr key={d.day}>
                <th scope="row" className="py-2 text-left font-normal whitespace-nowrap">
                  {dayLabel(d.day)}
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
        {!job.contactPublic && <p className="pb-group text-meta text-muted">这个职位不公开联系方式，在聊天里交换。</p>}
      </Section>
    </div>
  );
}
