"use client";
import type { Job } from "@/lib/types";
import { refreshMyJob, type ChangeResult } from "@/app/[lang]/employer/actions";
import { cardActions, type Asking, type CardActionKey } from "@/components/employer/job-card";
import { ButtonLink } from "@/components/ui/Button";
import { MoreMenu } from "@/components/ui/MoreMenu";
import { useLang, useMessages } from "@/i18n/client";
import { employerJobsMessages } from "@/i18n/messages/employer-jobs";

export { ACTION_BUTTON } from "@/components/employer/app-style";

export type { Asking } from "@/components/employer/job-card";

/** Runs a change and reports it, with the text to show when it worked. */
export type Run = (action: () => Promise<ChangeResult>, okText: string) => void;

/**
 * A job card's actions: one main button (查看, or 编辑 while the job waits for review) and the rest under
 * 更多. Outlined rather than solid: a list has many cards, and a screen keeps one solid button.
 */
export function JobActions({
  job,
  now,
  pending,
  asking,
  sharing,
  run,
  onAsk,
  onToggleShare,
}: {
  job: Job;
  now: number;
  pending: boolean;
  asking: Asking;
  sharing: boolean;
  run: Run;
  onAsk: (asking: Asking) => void;
  onToggleShare: () => void;
}) {
  const lang = useLang();
  const t = useMessages(employerJobsMessages).actions;
  const { main, more } = cardActions(job, now, { asking, sharing }, lang);
  const handlers: Record<CardActionKey, (() => void) | string> = {
    edit: `/employer/jobs/${job.id}`,
    renew: () => onAsk("renew"),
    republish: `/employer/jobs/${job.id}/republish`,
    refresh: () => run(() => refreshMyJob(job.id), t.refreshDone),
    share: onToggleShare,
    copy: `/employer/jobs/${job.id}/copy`,
    close: () => onAsk("close"),
    hires: () => onAsk("hires"),
  };

  return (
    <div className="mt-3 flex items-center gap-2">
      <ButtonLink variant="secondary" href={main.href} className="flex-1 sm:flex-none">
        {main.label}
      </ButtonLink>
      <MoreMenu
        label={t.moreMenuLabel(job.titleZh)}
        items={more.map(({ key, label, disabled, danger }) => {
          const action = handlers[key];
          const common = { label, danger, disabled: disabled || (key === "refresh" && pending) };
          return typeof action === "string" ? { ...common, href: action } : { ...common, onSelect: action };
        })}
      />
    </div>
  );
}
