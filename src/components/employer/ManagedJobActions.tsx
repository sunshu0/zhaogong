"use client";
import Link from "next/link";
import type { Job } from "@/lib/types";
import { refreshMyJob, type ChangeResult } from "@/app/employer/actions";
import { canClose, refreshState, type ShownStatus } from "@/components/employer/job-status";

export const ACTION_BUTTON = "h-9 rounded-lg border border-border px-3 text-sm disabled:opacity-40";

/** Runs a change and reports it, with the text to show when it worked. */
export type Run = (action: () => Promise<ChangeResult>, okText: string) => void;
/** Which question is open on the card: ending the job, or recording hires. */
export type Asking = "close" | "hires" | undefined;
type RefreshState = ReturnType<typeof refreshState>;

/** The buttons on a job card: edit, refresh or reopen, end, record hires, copy texts and view. */
export function JobActions({
  job,
  status,
  now,
  email,
  pending,
  asking,
  sharing,
  run,
  onAsk,
  onToggleShare,
}: {
  job: Job;
  status: ShownStatus;
  now: number;
  email: string;
  pending: boolean;
  asking: Asking;
  sharing: boolean;
  run: Run;
  onAsk: (asking: Asking) => void;
  onToggleShare: () => void;
}) {
  const refresh = refreshState(job, now);
  const canStartClosing = canClose(job, now) && !asking;
  const canRecordHires = status === "expired" && !asking;
  const isLive = status === "active";

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Link href={`/employer/jobs/${job.id}`} className={`${ACTION_BUTTON} inline-flex items-center`}>
        编辑
      </Link>
      <button
        type="button"
        disabled={!refresh.allowed || pending}
        title={refresh.reason_zh}
        onClick={() => run(() => refreshMyJob(job.id, email), refreshDoneText(status))}
        className={ACTION_BUTTON}
      >
        {refreshLabel(status, refresh)}
      </button>
      {canStartClosing && (
        <button type="button" onClick={() => onAsk("close")} className={ACTION_BUTTON}>
          结束招聘
        </button>
      )}
      {canRecordHires && (
        <button type="button" onClick={() => onAsk("hires")} className={ACTION_BUTTON}>
          {job.hiresConfirmed == null ? "记录招到几人" : "更正招到人数"}
        </button>
      )}
      {isLive && (
        <>
          <button type="button" aria-expanded={sharing} onClick={onToggleShare} className={ACTION_BUTTON}>
            {sharing ? "收起文案" : "复制文案"}
          </button>
          <Link href={`/jobs/${job.id}`} className="inline-flex h-9 items-center px-1 text-sm text-brand underline">
            查看
          </Link>
        </>
      )}
    </div>
  );
}

/** 重新开放 for an ended job; otherwise 刷新, or why it cannot be refreshed now. */
function refreshLabel(status: ShownStatus, refresh: RefreshState): string {
  if (status === "expired") return "重新开放";
  if (refresh.allowed) return "刷新";
  return refresh.reason_zh ?? "刷新";
}

function refreshDoneText(status: ShownStatus): string {
  return status === "expired" ? "已重新开放 30 天" : "已刷新，排到前面";
}
