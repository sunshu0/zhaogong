"use server";

// 职位提醒 (#53, PRD R-29): the signed-in account's alerts and the jobs they found. The account comes from the
// session cookie; an alert belongs to the account, and what it finds shows in the job seeker's notifications.
// Email alerts wait for an email service (#16).
import { DEFAULT_COUNTRY } from "@/config/countries";
import { getCurrentSession } from "@/lib/auth";
import { createJobAlert, deleteJobAlert, listJobAlerts, updateJobAlert, type JobAlert } from "@/db/job-alerts";
import { scopeOf } from "@/lib/chat-server/identity";
import { serverNotifications } from "@/app/messages/server-notifications";
import type { Notification } from "@/components/seeker/hub-state";
import { alertConditions, cleanAlertName, defaultAlertName, normalizeAlertQuery } from "@/components/seeker/job-alerts";

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
 * The server's notifications of the identity in use (server-notifications.ts): for a job seeker the jobs its alerts
 * found, for an employer applications and jobs closing soon. With the scope they are for, as the other notification
 * answers have (messages/actions.ts).
 */
export async function myAlertNotifications(): Promise<{ scope: string; items: Notification[] } | null> {
  const session = await getCurrentSession();
  if (!session) return null;
  const isEmployer = session.activeRole === "employer";
  return {
    scope: scopeOf(session),
    items: await serverNotifications({ email: session.email, isEmployer }, Date.now()),
  };
}
