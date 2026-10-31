"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { myApplicationViews, type MyApplicationView } from "@/app/[lang]/jobs/[id]/apply-actions";
import { RetryLine } from "@/components/seeker/RetryLine";
import { InterviewAnswer } from "@/components/seeker/InterviewAnswer";
import type { InterviewView } from "@/components/seeker/interviews";
import { formatJobDate } from "@/components/seeker/job-facts";
import { identityScope } from "@/components/seeker/identity-scope";
import { useSession } from "@/components/seeker/session-client";
import { Pay } from "@/components/ui/Pay";
import { Skeleton, SkeletonList } from "@/components/ui/Skeleton";
import { Tag } from "@/components/ui/Tag";
import { cardClass } from "@/components/ui/Card";
import { useLang, useMessages } from "@/i18n/client";
import { seekerMeMessages } from "@/i18n/messages/seeker-me";
import { contentLang } from "@/i18n/lang";

/**
 * 我的申请 on 收藏和进度 (#84): the jobs the account applied for or chatted about (ADR 0030), newest first, with how far each got (已申请, 雇主已看过,
 * 雇主觉得合适), and the employer's interview invitation to answer (#103). In two groups (#105): 进行中, and 已结束 once
 * hired or once the job ended. Nothing while there are none. Read only since the user took 申请 off the job pages
 * (10-20 11:0x): the records stay to look at, and an interview invitation can still be answered.
 */
export function MyApplications() {
  const t = useMessages(seekerMeMessages).applications;
  const session = useSession();
  const signedIn = Boolean(session);
  const scope = identityScope(session);
  const [list, setList] = useState<MyApplicationView[] | null>(null);
  // The list got no answer (#254): said with 重试, which asks again; kept per identity, so another identity's list
  // is not hidden behind it.
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const [asked, setAsked] = useState(0);
  const loadFailed = failedFor === scope;

  useEffect(() => {
    if (!signedIn) return;
    let current = true;
    myApplicationViews()
      .then((answer) => current && setList(answer))
      .catch(() => current && setFailedFor(scope));
    return () => {
      current = false;
    };
  }, [signedIn, scope, asked]);

  if (loadFailed)
    return (
      <RetryLine
        className="mb-4"
        text={t.loadFailed}
        onRetry={() => {
          setFailedFor(null);
          setAsked((n) => n + 1);
        }}
      />
    );
  // T5 (#405): while the list loads, its title and a card hold the place, so 收藏 below does not jump down later.
  if (signedIn && list === null)
    return (
      <div className="mb-6 space-y-3">
        <Skeleton className="h-7 w-28" />
        <SkeletonList count={1} />
      </div>
    );
  if (!list?.length) return null;

  const groups = [
    { stage: "open", label: t.open, items: list.filter((a) => a.stage === "open") },
    { stage: "ended", label: t.ended, items: list.filter((a) => a.stage === "ended") },
  ].filter((g) => g.items.length > 0);

  return (
    <section aria-labelledby="my-applications" className="mb-6">
      <h2 id="my-applications" className="mb-2 text-subtitle font-semibold">
        {t.title} <span className="text-body font-normal text-muted">{t.count(list.length)}</span>
      </h2>
      <p className="mb-3 text-meta text-muted">{t.readOnly}</p>
      <div className="space-y-4">
        {groups.map((g) => (
          <section key={g.stage} aria-labelledby={`my-applications-${g.stage}`}>
            <h3 id={`my-applications-${g.stage}`} className="mb-2 text-body font-semibold text-muted">
              {g.label} {g.items.length}
            </h3>
            <ul aria-label={t.groupLabel(g.label)} className="space-y-3">
              {g.items.map((a) => (
                <li key={a.jobId}>
                  <ApplicationCard
                    application={a}
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
 * One application. While it is 进行中 an interview can be answered; once 已结束 (#105) it stays as a record: the
 * status says 已录用 or 职位已结束.
 */
function ApplicationCard({
  application: a,
  onInterview,
}: {
  application: MyApplicationView;
  onInterview: (interview: InterviewView) => void;
}) {
  const lang = useLang();
  const t = useMessages(seekerMeMessages).applications;
  const open = a.stage === "open";
  return (
    <article aria-label={a.titleZh} className={cardClass()}>
      <div className="flex items-start justify-between gap-3">
        <h4 className="flex flex-wrap items-center gap-2 text-subtitle font-semibold">
          {a.gone ? (
            <span lang={contentLang(a.titleZh)} className="text-muted">
              {a.titleZh}
            </span>
          ) : (
            <Link href={`/jobs/${a.jobId}`} lang={contentLang(a.titleZh)} className="hover:text-brand">
              {a.titleZh}
            </Link>
          )}
          {a.gone && <Tag kind="neutral">{t.gone}</Tag>}
        </h4>
        <p className="shrink-0 leading-none">
          <Pay pay={a.pay} country={a.country} lang={lang} />
        </p>
      </div>
      <p className="mt-1 text-body text-muted">
        {a.region && `${a.region} · `}
        {a.employerName && (
          <>
            <span lang={contentLang(a.employerName)}>{a.employerName}</span> ·{" "}
          </>
        )}
        {(a.source === "chat" ? t.chattedOn : t.appliedOn)(formatJobDate(a.appliedAt, a.country, lang))}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-body ${open || a.status === t.status.hired ? "bg-brand-soft text-brand" : "bg-neutral-soft text-muted"}`}
        >
          {a.status}
        </span>
        {a.note && (
          <span className="min-w-0 truncate text-meta text-muted">
            {t.note("")}
            <span lang={contentLang(a.note)}>{a.note}</span>
          </span>
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
