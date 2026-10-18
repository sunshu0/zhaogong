"use server";

// 职位提醒 (#53, PRD R-29): the signed-in account's alerts and the jobs they found. The account comes from the
// session cookie; an alert belongs to the account, and what it finds shows in the job seeker's notifications. An
// alert is on the job list, or on 实习 or 专业职位 (#131). Email alerts wait for an email service (#16).
import { DEFAULT_COUNTRY } from "@/config/countries";
import { getCurrentSession } from "@/lib/auth";
import { createJobAlert, deleteJobAlert, listJobAlerts, updateJobAlert, type JobAlert } from "@/db/job-alerts";
import { scopeOf } from "@/lib/chat-server/identity";
import { serverNotifications } from "@/app/[lang]/messages/server-notifications";
import type { Notification } from "@/components/seeker/hub-state";
import { alertConditions, cleanAlertName, defaultAlertName, normalizeAlertQuery } from "@/components/seeker/job-alerts";
import { jobsHref } from "@/components/seeker/filter-query";
import {
  defaultExternalAlertName,
  externalAlertConditions,
  externalAlertHref,
  normalizeExternalQuery,
  parseSection,
} from "@/lib/external-jobs/alerts";
import type { ExternalSection } from "@/lib/external-jobs/filter";
import type { Lang } from "@/i18n/lang";
import { requestLang } from "@/i18n/server";

export type JobAlertView = {
  id: string;
  name: string;
  query: string;
  /** Null for the job list; the section of an alert on external jobs. */
  section: ExternalSection | null;
  /** The list the alert stands for. */
  href: string;
  conditions: string[];
  paused: boolean;
};

export type SaveAlertResult = { status: "created" | "exists"; alert: JobAlertView } | { status: "limit" };

function view(alert: JobAlert, lang: Lang): JobAlertView {
  const { id, name, query, paused } = alert;
  const section = parseSection(alert.section) ?? null;
  if (section) {
    const external = { section, query };
    return {
      id,
      name,
      query,
      paused,
      section,
      href: externalAlertHref(external),
      conditions: externalAlertConditions(external),
    };
  }
  return { id, name, query, paused, section, href: jobsHref(query), conditions: alertConditions(alert, lang) };
}

async function myEmail(): Promise<string | null> {
  return (await getCurrentSession())?.email ?? null;
}

/** The account's alerts, oldest first; null when signed out. */
export async function myJobAlerts(): Promise<JobAlertView[] | null> {
  const email = await myEmail();
  if (!email) return null;
  const lang = await requestLang();
  return (await listJobAlerts(email)).map((row) => view(row, lang));
}

/**
 * Saves the filters of the job list, or of 实习 or 专业职位 when `section` says so (#131), as an alert named after its
 * conditions. `query` is the list's query string.
 */
export async function saveMyJobAlert(query: string, section?: ExternalSection): Promise<SaveAlertResult | null> {
  const email = await myEmail();
  if (!email) return null;
  const on = parseSection(section);
  const stored = on ? normalizeExternalQuery(query, on) : normalizeAlertQuery(query, DEFAULT_COUNTRY);
  const name = on
    ? defaultExternalAlertName({ section: on, query: stored })
    : defaultAlertName({ country: DEFAULT_COUNTRY, query: stored }, await requestLang());
  const result = await createJobAlert(email, { country: DEFAULT_COUNTRY, query: stored, name, section: on });
  if (result.status === "no_account") return null; // a session always has its account
  return result.status === "limit" ? result : { status: result.status, alert: view(result.alert, await requestLang()) };
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
  const lang = await requestLang();
  return (await listJobAlerts(email)).map((row) => view(row, lang));
}

export async function deleteMyJobAlert(id: string): Promise<JobAlertView[] | null> {
  const email = await myEmail();
  if (!email) return null;
  if (typeof id === "string") await deleteJobAlert(email, id);
  const lang = await requestLang();
  return (await listJobAlerts(email)).map((row) => view(row, lang));
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
