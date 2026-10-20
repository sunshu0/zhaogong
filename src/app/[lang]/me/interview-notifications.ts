// 约面试 (#103) in the notification list and the workspace's to-dos, for either side. Not a Server Function: it
// takes the email, so only server code that read the email from the session calls it
// (messages/server-notifications.ts, me/interview-actions.ts). Server only.
import { getAccountEmployer, getEmployer, getJob } from "@/lib/data";
import { interviewsOfBusiness, interviewsOfSeeker, interviewView } from "@/db/interviews";
import { seekerJobKey, seekerNamesOfBusiness } from "@/db/conversations";
import { postedAgo } from "@/components/seeker/format";
import {
  formatSlot,
  interviewInviteNotificationId,
  interviewReplyNotificationId,
  interviewTodo,
  whenText,
  type InterviewView,
} from "@/components/seeker/interviews";
import type { Notification } from "@/components/seeker/hub-state";
import type { Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { seekerMeMessages } from "@/i18n/messages/seeker-me";
import { requestLang } from "@/i18n/server";

type Item = { interview: InterviewView; id: string; jobId: string; who: string; job: string };
type Identity = { email: string; isEmployer: boolean };

/** The job seeker's interviews; `who` is the business and the job. */
async function seekerItems(email: string, lang: Lang): Promise<Item[]> {
  const t = pick(seekerMeMessages, lang).notices;
  return Promise.all(
    (await interviewsOfSeeker(email)).map(async ({ interview, application }) => {
      const job = await getJob(application.jobId);
      const employer = job && (await getEmployer(job.employerId));
      const title = job?.titleZh ?? t.job;
      return {
        interview: interviewView(interview),
        id: interview.id,
        jobId: application.jobId,
        who: t.whoJob(employer?.name ?? "", title),
        job: title,
      };
    }),
  );
}

/** The business's interviews; `who` is the candidate's name (from the chat for one who did not apply, ADR 0030). */
async function employerItems(email: string, lang: Lang): Promise<Item[]> {
  const employer = await getAccountEmployer(email);
  if (!employer) return [];
  const rows = await interviewsOfBusiness(employer.id);
  const names = rows.some((r) => !r.application.profile) ? await seekerNamesOfBusiness(employer.id) : undefined;
  return Promise.all(
    rows.map(async ({ interview, application }) => ({
      interview: interviewView(interview),
      id: interview.id,
      jobId: application.jobId,
      who:
        application.profile?.name ??
        (names?.get(seekerJobKey(application.seekerEmail, application.jobId)) ||
          pick(seekerMeMessages, lang).notices.someone),
      job: (await getJob(application.jobId))?.titleZh ?? pick(seekerMeMessages, lang).notices.job,
    })),
  );
}

/**
 * The job seeker hears of each invitation and each change the employer makes (new times, cancelling); the employer
 * of each answer. Ids carry the time of the change, so a new one shows as unread again.
 */
export async function interviewNotifications(identity: Identity, now: number): Promise<Notification[]> {
  // The notices are made per request in the visitor's language (Round 20); `type` stays the list's key.
  const lang = await requestLang();
  const t = pick(seekerMeMessages, lang).notices;
  if (!identity.isEmployer)
    return (await seekerItems(identity.email, lang)).map(({ interview, id, who }) => ({
      id: interviewInviteNotificationId(id, interview.invitedAt),
      type: "面试",
      title: interview.status === "cancelled" ? t.interviewCancelled(who) : t.invited(who),
      detail: interview.status === "cancelled" ? t.employerCancelled : whenText(interview, lang),
      time: postedAgo(interview.invitedAt, now, lang),
      unread: true,
      target: { type: "applications" },
    }));
  return (await employerItems(identity.email, lang)).flatMap(({ interview, id, jobId, who, job }): Notification[] => {
    if (!interview.respondedAt || interview.status === "proposed" || interview.status === "cancelled") return [];
    const title =
      interview.status === "confirmed"
        ? t.confirmedBy(who, job)
        : interview.status === "declined"
          ? t.declinedBy(who, job)
          : t.repliedBy(who);
    const detail =
      interview.status === "confirmed"
        ? interview.chosenSlot
          ? formatSlot(interview.chosenSlot, lang)
          : t.callThem
        : interview.reply || t.noMessage;
    return [
      {
        id: interviewReplyNotificationId(id, interview.respondedAt),
        type: "面试",
        title,
        detail,
        time: postedAgo(interview.respondedAt, now, lang),
        unread: true,
        target: { type: "applicants", jobId },
      },
    ];
  });
}

export type InterviewTodo = { id: string; title: string; detail: string; href: string };

/** 待确认的面试 and 今天 / 明天的面试 for the workspace. */
export async function interviewTodos(identity: Identity, now: number): Promise<InterviewTodo[]> {
  const side = identity.isEmployer ? "employer" : "seeker";
  const lang = await requestLang();
  const items = identity.isEmployer
    ? await employerItems(identity.email, lang)
    : await seekerItems(identity.email, lang);
  return items.flatMap(({ interview, id, jobId, who }) => {
    const todo = interviewTodo(interview, side, who, now, lang);
    if (!todo) return [];
    const href = identity.isEmployer ? `/employer/jobs/${encodeURIComponent(jobId)}/applicants` : "/me/saved";
    return [{ id: `interview:${id}`, ...todo, href }];
  });
}
