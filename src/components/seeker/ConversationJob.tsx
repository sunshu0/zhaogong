"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { jobSummary, type JobSummary } from "@/app/jobs/[id]/actions";

/** The job a conversation is about, fixed above the messages so both sides know which job they are discussing. */
export function ConversationJob({ jobId, fallbackTitle }: { jobId: string; fallbackTitle: string }) {
  const [loaded, setLoaded] = useState<{ jobId: string; job: JobSummary | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    jobSummary(jobId)
      .catch(() => null)
      .then((job) => {
        if (!cancelled) setLoaded({ jobId, job });
      });
    return () => {
      cancelled = true;
    };
  }, [jobId]);
  const job = loaded?.jobId === jobId ? loaded.job : undefined;
  if (job === null) return null; // taken down or gone: nothing to link to

  return (
    <Link
      href={`/jobs/${jobId}`}
      aria-label={`聊的职位：${job?.title ?? fallbackTitle}${job ? `，${job.pay}` : ""}，查看职位详情`}
      className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2 text-body hover:bg-background lg:px-6"
    >
      <span className="shrink-0 text-meta text-muted">职位</span>
      <span className="min-w-0 truncate font-medium">{job?.title ?? fallbackTitle}</span>
      {job && <span className="shrink-0 font-semibold text-brand">{job.pay}</span>}
      {job && !job.open && <span className="shrink-0 text-meta text-muted">已停止招聘</span>}
      <ChevronRight aria-hidden="true" className="ml-auto size-4 shrink-0 text-muted" />
    </Link>
  );
}
