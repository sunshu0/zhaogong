"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  myApplicationViews,
  withdrawMyApplication,
  type MyApplicationView,
} from "@/app/[lang]/jobs/[id]/apply-actions";
import { refreshApplied } from "@/components/seeker/applied-client";
import { InterviewAnswer } from "@/components/seeker/InterviewAnswer";
import type { InterviewView } from "@/components/seeker/interviews";
import { formatDateZh } from "@/components/seeker/job-facts";
import { useSession } from "@/components/seeker/session-client";
import { Pay } from "@/components/ui/Pay";
import { Tag } from "@/components/ui/Tag";
import { cardClass } from "@/components/ui/Card";

/**
 * 我的申请 on 收藏和进度 (#84): the jobs the account applied for, newest first, with how far each got (已申请, 雇主已看过,
 * 雇主觉得合适), and the employer's interview invitation to answer (#103). In two groups (#105): 进行中, and 已结束 once
 * hired or once the job ended. Nothing while there are none. Withdrawing takes the application off the employer's list.
 */
export function MyApplications() {
  const signedIn = Boolean(useSession());
  const [list, setList] = useState<MyApplicationView[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!signedIn) return;
    let current = true;
    myApplicationViews()
      .then((answer) => current && setList(answer))
      .catch(() => current && setError("网络有问题，申请记录暂时打不开。"));
    return () => {
      current = false;
    };
  }, [signedIn]);

  if (error)
    return (
      <p role="alert" className="mb-4 text-body text-danger">
        {error}
      </p>
    );
  if (!list?.length) return null;

  async function withdraw(jobId: string) {
    setError("");
    const ok = await withdrawMyApplication(jobId).catch(() => false);
    if (!ok) return setError("没能撤回，请稍后再试。");
    setList((current) => current?.filter((a) => a.jobId !== jobId) ?? null);
    refreshApplied();
  }

  const groups = [
    { stage: "open", label: "进行中", items: list.filter((a) => a.stage === "open") },
    { stage: "ended", label: "已结束", items: list.filter((a) => a.stage === "ended") },
  ].filter((g) => g.items.length > 0);

  return (
    <section aria-labelledby="my-applications" className="mb-6">
      <h2 id="my-applications" className="mb-2 text-subtitle font-semibold">
        我的申请 <span className="text-body font-normal text-muted">{list.length} 个</span>
      </h2>
      <div className="space-y-4">
        {groups.map((g) => (
          <section key={g.stage} aria-labelledby={`my-applications-${g.stage}`}>
            <h3 id={`my-applications-${g.stage}`} className="mb-2 text-body font-semibold text-muted">
              {g.label} {g.items.length}
            </h3>
            <ul aria-label={`${g.label}的申请`} className="space-y-3">
              {g.items.map((a) => (
                <li key={a.jobId}>
                  <ApplicationCard
                    application={a}
                    onWithdraw={() => void withdraw(a.jobId)}
                    onInterview={(interview) =>
                      setList((current) => current?.map((x) => (x.jobId === a.jobId ? { ...x, interview } : x)) ?? null)
                    }
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}

/**
 * One application. While it is 进行中 it can be withdrawn and an interview answered; once 已结束 (#105) it stays as a
 * record: the status says 已录用 or 职位已结束.
 */
function ApplicationCard({
  application: a,
  onWithdraw,
  onInterview,
}: {
  application: MyApplicationView;
  onWithdraw: () => void;
  onInterview: (interview: InterviewView) => void;
}) {
  const open = a.stage === "open";
  return (
    <article aria-label={a.titleZh} className={cardClass()}>
      <div className="flex items-start justify-between gap-3">
        <h4 className="flex flex-wrap items-center gap-2 text-subtitle font-semibold">
          {a.gone ? (
            <span className="text-muted">{a.titleZh}</span>
          ) : (
            <Link href={`/jobs/${a.jobId}`} className="hover:text-brand">
              {a.titleZh}
            </Link>
          )}
          {a.gone && <Tag kind="neutral">已下架</Tag>}
        </h4>
        <p className={`shrink-0 leading-none ${a.gone ? "opacity-60" : ""}`}>
          <Pay pay={a.pay} country={a.country} />
        </p>
      </div>
      <p className="mt-1 text-body text-muted">
        {[a.region, a.employerName].filter(Boolean).join(" · ")} · {formatDateZh(a.appliedAt, a.country)}申请
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-body ${open || a.status === "已录用" ? "bg-brand-soft text-brand" : "bg-neutral-soft text-muted"}`}
        >
          {a.status}
        </span>
        {a.note && <span className="min-w-0 truncate text-meta text-muted">附言：{a.note}</span>}
        {open && (
          <button
            type="button"
            onClick={onWithdraw}
            className="pressable ml-auto inline-flex min-h-11 items-center text-meta text-muted hover:text-danger"
          >
            撤回申请
          </button>
        )}
      </div>
      {open && a.interview && (
        <InterviewAnswer
          jobId={a.jobId}
          title={[a.titleZh, a.employerName].filter(Boolean).join("，")}
          interview={a.interview}
          onChange={onInterview}
        />
      )}
    </article>
  );
}
