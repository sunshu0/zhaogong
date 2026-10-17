"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { CountryCode, Job } from "@/lib/types";
import { publishJob } from "@/app/employer/actions";
import { DraftEditor } from "@/components/employer/DraftEditor";
import { canRepublish, closeDateZh } from "@/components/employer/job-status";
import { formFromDraft } from "@/components/employer/post-form";
import { PUBLISH_ERRORS } from "@/components/employer/post-flow-state";
import { Published } from "@/components/employer/Published";
import { EmployerGate, type EmployerIdentity } from "@/components/employer/EmployerGate";
import { CLEAR_OF_STICKY_BARS, holdReason, keepFocusClear, useDraftForm } from "@/components/employer/use-draft-form";
import { useEmployerProfile } from "@/components/employer/use-employer";
import { useFocusOnChange } from "@/components/employer/use-focus-on-change";
import { useMyJob } from "@/components/employer/use-my-jobs";
import { WIDE_ON_DESKTOP } from "@/components/ui/wide";
import { Button } from "@/components/ui/Button";
import { BAR_TEXT_ACTION, STICKY_BAR } from "@/components/employer/app-style";
import { SkeletonList } from "@/components/ui/Skeleton";

const BOX = "rounded-card bg-surface px-4 py-8 shadow-card text-center text-body text-muted";

/**
 * 重新发布 (#69): a job that closed more than 14 days ago, as a new draft with its content. It goes through the same
 * form and checks as posting — the rules of today, such as the minimum wage — and is published as a new job; the
 * old one stays ended.
 */
export function RepublishJob({ jobId, country }: { jobId: string; country: CountryCode }) {
  return (
    <EmployerGate next={`/employer/jobs/${jobId}/republish`}>
      {(me) => <Load jobId={jobId} me={me} country={country} />}
    </EmployerGate>
  );
}

function Load({ jobId, me, country }: { jobId: string; me: EmployerIdentity; country: CountryCode }) {
  const job = useMyJob(jobId, me.email);
  // The time the page opened decides whether the job may be published again; it stays fixed while the form is open.
  const [openedAt] = useState(() => Date.now());

  if (job === undefined) return <SkeletonList count={2} />;
  if (!job || !canRepublish(job, openedAt)) {
    return (
      <div className={BOX}>
        {job
          ? "只有截止超过 14 天的职位才需要重新发布。这个职位可以在职位管理里续期。"
          : "找不到这个职位，或者它不属于你登录的店铺。"}
        <Link href="/employer/jobs" className="mt-3 block text-brand underline">
          回到职位管理
        </Link>
      </div>
    );
  }
  return <RepublishForm key={job.id} job={job} email={me.email} country={country} />;
}

function RepublishForm({ job, email, country }: { job: Job; email: string; country: CountryCode }) {
  const router = useRouter();
  const { profile } = useEmployerProfile(email);
  const state = useDraftForm(country, { form: formFromDraft(job), englishByHand: true }, profile);
  const [pending, startTransition] = useTransition();
  const [published, setPublished] = useState<Job>();
  const heading = useFocusOnChange<HTMLHeadingElement>(published?.id);
  const [error, setError] = useState<string>();

  function publish() {
    setError(undefined);
    startTransition(async () => {
      const result = await publishJob(state.draft);
      if (result.ok) setPublished(result.job);
      else setError(PUBLISH_ERRORS[result.reason]);
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
        <h1 className="text-title font-semibold">重新发布</h1>
        <p className="mt-1 text-body text-muted">
          用「{job.titleZh}」（{closeDateZh(job.expiresAt)}
          截止）的内容新建一条职位。发布前按现在的规则重新检查，例如最低工资；原来的职位保持已截止。
        </p>
      </div>
      {error && <p className="rounded-control bg-danger-soft px-3 py-2 text-body text-danger">{error}</p>}
      <div onFocus={keepFocusClear} className={`${WIDE_ON_DESKTOP} ${CLEAR_OF_STICKY_BARS}`}>
        <DraftEditor state={state} country={country} />
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
