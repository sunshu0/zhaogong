"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { CountryCode, Job } from "@/lib/types";
import { publishJob } from "@/app/[lang]/employer/actions";
import { canCopy, canRepublish, closeDateZh } from "@/components/employer/job-status";
import { PUBLISH_ERRORS } from "@/components/employer/post-flow-state";
import { Published } from "@/components/employer/Published";
import { EmployerGate, type EmployerIdentity } from "@/components/employer/EmployerGate";
import { CLEAR_OF_STICKY_BARS, holdReason, keepFocusClear } from "@/components/employer/use-draft-form";
import { JobFormPart, KeptChangesNote, useKeptJobForm } from "@/components/employer/KeptJobForm";
import { DuplicateJobNote } from "@/components/employer/DuplicateJobNote";
import { useEmployerProfile } from "@/components/employer/use-employer";
import { useFocusOnChange } from "@/components/employer/use-focus-on-change";
import { useMyJob } from "@/components/employer/use-my-jobs";
import { WIDE_ON_DESKTOP } from "@/components/ui/wide";
import { Button } from "@/components/ui/Button";
import { BAR_TEXT_ACTION, STICKY_BAR } from "@/components/employer/app-style";
import { SkeletonList } from "@/components/ui/Skeleton";

const BOX = "rounded-card bg-surface px-4 py-8 shadow-card text-center text-body text-muted";

/**
 * 重新发布 (#69): a job that closed more than 14 days ago, as a new draft with its content; 复制为新职位 (#190): the
 * same for a live or ended job. Both go through the same form and checks as posting — the rules of today, such as
 * the minimum wage — and publish a new job, with no applicants, renewals or numbers of the old one, posted by whoever
 * publishes it (#182). The old job stays as it was.
 */
export type CopyMode = "republish" | "copy";

export function RepublishJob({
  jobId,
  country,
  mode = "republish",
}: {
  jobId: string;
  country: CountryCode;
  mode?: CopyMode;
}) {
  return (
    <EmployerGate next={`/employer/jobs/${jobId}/${mode}`}>
      {(me) => <Load jobId={jobId} me={me} country={country} mode={mode} />}
    </EmployerGate>
  );
}

function Load({
  jobId,
  me,
  country,
  mode,
}: {
  jobId: string;
  me: EmployerIdentity;
  country: CountryCode;
  mode: CopyMode;
}) {
  const job = useMyJob(jobId, me.email);
  // The time the page opened decides whether the job may be published again; it stays fixed while the form is open.
  const [openedAt] = useState(() => Date.now());

  if (job === undefined) return <SkeletonList count={2} />;
  const allowed = job && (mode === "copy" ? canCopy(job) : canRepublish(job, openedAt));
  if (!job || !allowed) {
    return (
      <div className={BOX}>
        {!job
          ? "找不到这个职位，或者它不属于你登录的店铺。"
          : mode === "copy"
            ? "下架的职位和还在审核的职位不能复制。"
            : "只有截止超过 14 天的职位才需要重新发布。这个职位可以在职位管理里续期。"}
        <Link href="/employer/jobs" className="mt-3 block text-brand underline">
          回到职位管理
        </Link>
      </div>
    );
  }
  return <RepublishForm key={job.id} job={job} email={me.email} country={country} mode={mode} />;
}

function RepublishForm({
  job,
  email,
  country,
  mode,
}: {
  job: Job;
  email: string;
  country: CountryCode;
  mode: CopyMode;
}) {
  const router = useRouter();
  const { profile } = useEmployerProfile(email);
  const { state, restored, startOver, finish } = useKeptJobForm(mode, job, email, country, profile);
  const [pending, startTransition] = useTransition();
  const [published, setPublished] = useState<Job>();
  const heading = useFocusOnChange<HTMLHeadingElement>(published?.id);
  const [error, setError] = useState<string>();

  function publish() {
    setError(undefined);
    startTransition(async () => {
      const result = await publishJob(state.draft);
      if (result.ok) {
        finish();
        setPublished(result.job);
      } else setError(PUBLISH_ERRORS[result.reason]);
      window.scrollTo({ top: 0 });
    });
  }

  if (published) {
    return (
      <Published
        job={published}
        employer={profile ?? undefined}
        headingRef={heading}
        onAgain={() => router.push("/employer/post")}
      />
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <div>
        <h1 className="text-title font-semibold">{mode === "copy" ? "复制为新职位" : "重新发布"}</h1>
        {mode === "copy" ? (
          <p className="mt-1 text-body text-muted">
            用「{job.titleZh}
            」的内容新建一条职位，改好后发布。新职位从零开始：没有原职位的申请人、续期和浏览数据；发布前照常检查。原来的职位不变。
          </p>
        ) : (
          <p className="mt-1 text-body text-muted">
            用「{job.titleZh}」（{closeDateZh(job.expiresAt)}
            截止）的内容新建一条职位。发布前按现在的规则重新检查，例如最低工资；原来的职位保持已截止。
          </p>
        )}
      </div>
      {error && <p className="rounded-control bg-danger-soft px-3 py-2 text-body text-danger">{error}</p>}
      {restored && <KeptChangesNote onStartOver={startOver} />}
      <DuplicateJobNote titleZh={state.form.titleZh} />
      <div onFocus={keepFocusClear} className={`${WIDE_ON_DESKTOP} ${CLEAR_OF_STICKY_BARS}`}>
        <JobFormPart state={state} country={country} />
      </div>
      <div className={`${STICKY_BAR} ${WIDE_ON_DESKTOP}`}>
        <div className="flex items-center gap-3">
          <Link href="/employer/jobs" className={BAR_TEXT_ACTION}>
            取消
          </Link>
          <p className="flex-1 text-meta text-muted">
            {state.ready
              ? state.decision.status === "pending_review"
                ? "发布后需要审核"
                : "可以发布"
              : holdReason(state.findings.length, state.missing.length)}
          </p>
          <Button size="lg" loading={pending} disabled={!state.ready} onClick={publish} className="px-6">
            {pending ? "发布中…" : "发布"}
          </Button>
        </div>
      </div>
    </div>
  );
}
