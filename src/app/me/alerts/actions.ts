"use server";

// 职位提醒 (#53, PRD R-29): the signed-in account's alerts and the jobs they found. The account comes from the
// session cookie; an alert belongs to the account, and what it finds shows in the job seeker's notifications.
// Email alerts wait for an email service (#16).
import { DEFAULT_COUNTRY } from "@/config/countries";
import { getCurrentSession } from "@/lib/auth";
import { getEmployer, getJob } from "@/lib/data";
import { isOpenJob } from "@/lib/job-expiry";
import {
  createJobAlert,
  deleteJobAlert,
  listJobAlertHits,
  listJobAlerts,
  updateJobAlert,
  type JobAlert,
} from "@/db/job-alerts";
import { scopeOf } from "@/lib/chat-server/identity";
import { postedAgoZh } from "@/components/seeker/format";
import { myClosingNotifications } from "@/app/employer/closing-notifications";
import { myApplicationNotifications } from "@/app/employer/application-notifications";
import type { Notification } from "@/components/seeker/hub-state";
import {
  alertConditions,
  alertNotificationId,
  cleanAlertName,
  defaultAlertName,
  normalizeAlertQuery,
} from "@/components/seeker/job-alerts";

export type JobAlertView = { id: string; name: string; query: string; conditions: string[]; paused: boolean };

export type SaveAlertResult = { status: "created" | "exists"; alert: JobAlertView } | { status: "limit" };

function view(alert: JobAlert): JobAlertView {
  const { id, name, query, paused } = alert;
  return { id, name, query, paused, conditions: alertConditions(alert) };
}

async function myEmail(): Promise<string | null> {
  return (await getCurrentSession())?.email ?? null;
}

/** The account's alerts, oldest first; null when signed out. */
export async function myJobAlerts(): Promise<JobAlertView[] | null> {
  const email = await myEmail();
  return email ? (await listJobAlerts(email)).map(view) : null;
}

/** Saves the job list's filters (its query string) as an alert, named after its conditions. */
export async function saveMyJobAlert(query: string): Promise<SaveAlertResult | null> {
  const email = await myEmail();
  if (!email) return null;
  const stored = { country: DEFAULT_COUNTRY, query: normalizeAlertQuery(query, DEFAULT_COUNTRY) };
  const result = await createJobAlert(email, { ...stored, name: defaultAlertName(stored) });
  if (result.status === "no_account") return null; // a session always has its account
  return result.status === "limit" ? result : { status: result.status, alert: view(result.alert) };
}

/** Renames, pauses or resumes an alert; answers with the account's alerts as they now are. */
export async function changeMyJobAlert(id: string, change: { name?: string; paused?: boolean }) {
  const email = await myEmail();
  if (!email) return null;
  if (typeof id === "string" && change && typeof change === "object") {
    const name = cleanAlertName(change.name);
    const paused = typeof change.paused === "boolean" ? change.paused : undefined;
    if (name !== undefined || paused !== undefined) await updateJobAlert(email, id, { name, paused });
  }
  return (await listJobAlerts(email)).map(view);
}

export async function deleteMyJobAlert(id: string): Promise<JobAlertView[] | null> {
  const email = await myEmail();
  if (!email) return null;
  if (typeof id === "string") await deleteJobAlert(email, id);
  return (await listJobAlerts(email)).map(view);
}

/**
 * The jobs the account's alerts found, as notifications of its job-seeker identity (the employer identity has
 * none). With the scope they are for, as the other notification answers have (messages/actions.ts).
 */
export async function myAlertNotifications(): Promise<{ scope: string; items: Notification[] } | null> {
  const session = await getCurrentSession();
  if (!session) return null;
  const scope = scopeOf(session);
  const now = Date.now();
  // The employer identity's are applications (#84) and its jobs closing soon (#69).
  if (session.activeRole === "employer")
    return {
      scope,
      items: [
        ...(await myApplicationNotifications(session.email, now)),
        ...(await myClosingNotifications(session.email, now)),
      ],
    };
  const items = await Promise.all(
    (await listJobAlertHits(session.email)).map(async (hit): Promise<Notification> => {
      const job = await getJob(hit.jobId);
      const employer = job && (await getEmployer(job.employerId));
      return {
        id: alertNotificationId(hit.jobId),
        type: "提醒",
        title: `有新职位符合提醒「${hit.alertName}」`,
        detail:
          job && isOpenJob(job, now)
            ? `${employer?.name ?? ""}正在招聘${job.titleZh}`
            : `${job?.titleZh ?? "这个职位"}已经停止招聘`,
        time: postedAgoZh(hit.createdAt, now),
        unread: true,
        target: { type: "job", id: hit.jobId },
      };
    }),
  );
  return { scope, items };
}
