// 我的申请's rows as the job seeker sees them (#84, ADR 0030), for jobs/[id]/apply-actions.ts. Applying went with the
// 申请 button (10-20 11:0x); a job's candidates now come from its chats (src/db/conversations.ts). Not a Server
// Function file, so the shapes and view() can be shared. Server only.
import type { CountryCode, PayRange } from "@/lib/types";
import { seekerStatus, type ApplicationDecision, type ApplicationSource } from "@/components/seeker/applications";
import type { InterviewView } from "@/components/seeker/interviews";
import type { Lang } from "@/i18n/lang";

/** The account's application for one job, or a job they chatted about (no note), as the job seeker sees it. */
export type MyApplication = {
  jobId: string;
  source: ApplicationSource;
  appliedAt: string;
  note: string | null;
  status: string;
};

/** One of the account's applications, with the job, for 收藏和进度. */
export type MyApplicationView = MyApplication & {
  titleZh: string;
  titleEn: string;
  pay: PayRange;
  country: CountryCode;
  region?: string;
  employerName?: string;
  /** Taken down or past its closing date. */
  gone: boolean;
  /** 进行中, or 已结束 once the person is hired or the job has ended (#105). */
  stage: "open" | "ended";
  /** The employer's interview invitation, if any (#103). */
  interview: InterviewView | null;
};

export function view(
  row: {
    jobId: string;
    source: ApplicationSource;
    appliedAt: string;
    note: string | null;
    seenAt: string | null;
    decision: ApplicationDecision | null;
  },
  ended = false,
  lang: Lang = "zh",
): MyApplication {
  return {
    jobId: row.jobId,
    source: row.source,
    appliedAt: row.appliedAt,
    note: row.note,
    status: seekerStatus(row, ended, lang),
  };
}
