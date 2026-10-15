// What a card on 职位管理 shows: the same numbers on every card, one main button and the rest under 更多.
import type { Job } from "@/lib/types";
import type { JobNumbers } from "@/db/job-stats";
import { canClose, effectiveStatus, refreshState } from "@/components/employer/job-status";

/** Which question is open on the card: ending the job, or recording hires. */
export type Asking = "close" | "hires" | undefined;

export type CardActionKey = "edit" | "refresh" | "share" | "close" | "hires";

export interface CardActions {
  main: { label: string; href: string };
  more: { key: CardActionKey; label: string; disabled?: boolean; danger?: boolean }[];
}

/** Page views, chats, then contact views (public details) or how details are swapped (private), from the server (#55). */
export function cardNumbers(job: Pick<Job, "contactPublic">, numbers: JobNumbers): string[] {
  return [
    `${numbers.views} 次浏览`,
    numbers.chats > 0 ? `${numbers.chats} 人聊过` : "还没有人聊过",
    job.contactPublic ? `${numbers.contactViews} 次查看联系方式` : "不公开 · 聊天交换",
  ];
}

export const NO_NUMBERS: JobNumbers = { views: 0, chats: 0, contactViews: 0 };

type CardJob = Pick<Job, "id" | "status" | "postedAt" | "expiresAt" | "hiresConfirmed">;

/**
 * 查看 opens the job as seekers see it, so it is the main button while seekers can open the job (live or
 * ended); while it waits for review the main button is 编辑. Refresh is listed even when it cannot run,
 * with the reason as its label.
 */
export function cardActions(
  job: CardJob,
  now: number,
  { asking, sharing }: { asking: Asking; sharing: boolean },
): CardActions {
  const status = effectiveStatus(job, now);
  const seekersCanOpen = status === "active" || status === "expired";
  const edit = { label: "编辑", href: `/employer/jobs/${job.id}` };
  const refresh = refreshState(job, now);
  const more: CardActions["more"] = [];

  if (seekersCanOpen) more.push({ key: "edit", label: edit.label });
  more.push({
    key: "refresh",
    label: status === "expired" ? "重新开放" : refresh.allowed ? "刷新" : (refresh.reason_zh ?? "刷新"),
    disabled: !refresh.allowed,
  });
  if (status === "active") more.push({ key: "share", label: sharing ? "收起文案" : "复制文案" });
  if (canClose(job, now) && !asking) more.push({ key: "close", label: "结束招聘", danger: true });
  if (status === "expired" && !asking)
    more.push({ key: "hires", label: job.hiresConfirmed == null ? "记录招到几人" : "更正招到人数" });

  return { main: seekersCanOpen ? { label: "查看", href: `/jobs/${job.id}` } : edit, more };
}
