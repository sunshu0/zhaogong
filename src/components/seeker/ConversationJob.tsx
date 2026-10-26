"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { jobSummary, type JobSummary } from "@/app/[lang]/jobs/[id]/actions";
import { Skeleton } from "@/components/ui/Skeleton";
import { useMessages } from "@/i18n/client";
import { contentLang } from "@/i18n/lang";
import { chatMessages } from "@/i18n/messages/chat";

/**
 * The job a conversation is about, fixed above the messages so both sides know which job they are discussing. While
 * the job loads, a grey shape holds the pay's place (T5, #405), so nothing moves when it comes.
 */
export function ConversationJob({ jobId, fallbackTitle }: { jobId: string; fallbackTitle: string }) {
  const t = useMessages(chatMessages).conversationJob;
  // `job` undefined: no answer (#252).
  const [loaded, setLoaded] = useState<{ jobId: string; job?: JobSummary | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    // No answer (#252) is not "gone": the bar stays, with the conversation's own title for the job and no pay.
    jobSummary(jobId).then(
      (job) => !cancelled && setLoaded({ jobId, job }),
      () => !cancelled && setLoaded({ jobId }),
    );
    return () => {
      cancelled = true;
    };
  }, [jobId]);
  const answered = loaded?.jobId === jobId;
  const job = answered ? loaded.job : undefined;
  if (job === null) return null; // taken down or gone: nothing to link to

  return (
    <Link
      href={`/jobs/${jobId}`}
      aria-label={job ? t.linkWithPay(job.title, job.pay) : t.link(fallbackTitle)}
      className="pressable-row flex min-h-11 shrink-0 items-center gap-2 border-b border-border px-4 py-2 text-body hover:bg-background lg:px-6"
    >
      <span className="shrink-0 text-meta text-muted">{t.label}</span>
      <span lang={contentLang(job?.title ?? fallbackTitle)} className="min-w-0 truncate font-medium">
        {job?.title ?? fallbackTitle}
      </span>
      {job && <PayText pay={job.pay} />}
      {!answered && <Skeleton className="h-6 w-16 shrink-0" />}
      {job && !job.open && <span className="shrink-0 text-meta text-muted">{t.closed}</span>}
      <ChevronRight aria-hidden="true" className="ml-auto size-4 shrink-0 text-muted" />
    </Link>
  );
}

/**
 * The pay as text from the server, set like Pay (Round 13): the figure narrow in brand colour, the unit small.
 * The unit comes at the end in either language and starts at the first 「/」 or space:「$25/小时」, "$25 an hour".
 */
function PayText({ pay }: { pay: string }) {
  const match = /^([^/\s]*)\s*(.*)$/.exec(pay.trim());
  const amount = match?.[1] ?? pay;
  const unit = match?.[2] ?? "";
  return (
    <span className="inline-flex shrink-0 items-baseline text-brand">
      <span className="font-figure text-[1.25rem]">{amount}</span>
      {unit && <span className={`${unit.startsWith("/") ? "ml-0.5" : "ml-1"} text-meta text-muted`}>{unit}</span>}
    </span>
  );
}
