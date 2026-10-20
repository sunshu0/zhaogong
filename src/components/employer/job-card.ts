// What a card on 职位管理 shows: the same numbers on every card, one main button and the rest under 更多.
// Round 20 (ADR 0023): the wording comes from the employer-jobs dictionary, Chinese unless a language is passed.
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { employerJobsMessages } from "@/i18n/messages/employer-jobs";
import type { Job } from "@/lib/types";
import type { JobNumbers } from "@/db/job-stats";
import type { ApplicationCount } from "@/db/job-applications";
import {
  canClose,
  canCopy,
  canRepublish,
  effectiveStatus,
  refreshState,
  renewState,
} from "@/components/employer/job-status";

/** Which question is open on the card: ending the job, recording hires, or how long to renew it for. */
export type Asking = "close" | "hires" | "renew" | undefined;

export type CardActionKey = "edit" | "renew" | "republish" | "refresh" | "share" | "copy" | "close" | "hires";

export interface CardActions {
  main: { label: string; href: string };
  more: { key: CardActionKey; label: string; disabled?: boolean; danger?: boolean }[];
}

/** Page views, chats, then contact views (public details) or how details are swapped (private), from the server (#55). */
export function cardNumbers(job: Pick<Job, "contactPublic">, numbers: JobNumbers, lang: Lang = DEFAULT_LANG): string[] {
  const t = pick(employerJobsMessages, lang).numbers;
  return [
    t.views(numbers.views),
    numbers.chats > 0 ? t.chats(numbers.chats) : t.noChats,
    job.contactPublic ? t.contactViews(numbers.contactViews) : t.contactPrivate,
  ];
}

export const NO_NUMBERS: JobNumbers = { views: 0, chats: 0, contactViews: 0 };

type CardJob = Pick<Job, "id" | "status" | "postedAt" | "expiresAt" | "hiresConfirmed">;

/**
 * 查看 opens the job as seekers see it, so it is the main button while seekers can open the job (live or
 * ended); while it waits for review the main button is 编辑. A live job can be renewed and refreshed (refresh is
 * listed even when it cannot run, with the reason as its label); an ended one is renewed for 14 days after it
 * closed, and after that published again as a new job (#69). Until then any live or ended job can be copied into a
 * new one (#190); 结束招聘 stays the last item.
 */
export function cardActions(
  job: CardJob,
  now: number,
  { asking, sharing }: { asking: Asking; sharing: boolean },
  lang: Lang = DEFAULT_LANG,
): CardActions {
  const t = pick(employerJobsMessages, lang).actions;
  const status = effectiveStatus(job, now);
  const seekersCanOpen = status === "active" || status === "expired";
  const edit = { label: t.edit, href: `/employer/jobs/${job.id}` };
  const refresh = refreshState(job, now, lang);
  const renew = renewState(job, now, lang);
  const more: CardActions["more"] = [];

  if (seekersCanOpen) more.push({ key: "edit", label: edit.label });
  if (status === "active" || (status === "expired" && renew.allowed))
    more.push({ key: "renew", label: renew.allowed ? t.renew : renew.reason_zh, disabled: !renew.allowed || !!asking });
  if (canRepublish(job, now)) more.push({ key: "republish", label: t.republish });
  if (status !== "expired")
    more.push({
      key: "refresh",
      label: refresh.allowed ? t.refresh : (refresh.reason_zh ?? t.refresh),
      disabled: !refresh.allowed,
    });
  if (status === "active") more.push({ key: "share", label: sharing ? t.hideShare : t.share });
  if (canCopy(job) && !canRepublish(job, now)) more.push({ key: "copy", label: t.copy });
  if (canClose(job, now) && !asking) more.push({ key: "close", label: t.close, danger: true });
  if (status === "expired" && !asking)
    more.push({ key: "hires", label: job.hiresConfirmed == null ? t.recordHires : t.correctHires });

  return { main: seekersCanOpen ? { label: t.view, href: `/jobs/${job.id}` } : edit, more };
}

/** 「聊过的人 3 · 1 个新申请」 on a job card (ADR 0030); 「聊过的人 0」 before anyone chatted or applied. */
export function applicantsLabelZh(count?: ApplicationCount, lang: Lang = DEFAULT_LANG): string {
  const t = pick(employerJobsMessages, lang).numbers;
  if (!count?.total) return t.noApplicants;
  return count.unseen ? t.applicantsWithNew(count.total, count.unseen) : t.applicants(count.total);
}
