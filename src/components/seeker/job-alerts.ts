// 职位提醒 (#53, PRD R-29): the parts the browser and the server share. An alert is the job list's filter, kept as
// its query string (filter-query.ts) so a stored alert reads the same way a shared link does, plus a name.
import { filterChips, filterToQuery, parseFilter, toParams } from "@/components/seeker/filter-query";
import type { CountryCode, JobFilter } from "@/lib/types";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { seekerMeMessages } from "@/i18n/messages/seeker-me";

/** The page where the account manages its alerts. */
export const ALERTS_PATH = "/me/alerts";
/** Alerts per account. */
export const ALERT_LIMIT = 5;
export const ALERT_NAME_MAX = 20;

type StoredAlert = { country: CountryCode; query: string };

/** The filter an alert stands for. Values the app no longer knows drop out, as they do from a link. */
export function alertFilter(alert: StoredAlert): JobFilter {
  return parseFilter(toParams(new URLSearchParams(alert.query)), alert.country);
}

/** A query from the browser in the one form alerts are stored in, so the same search is recognised twice. */
export function normalizeAlertQuery(query: unknown, country: CountryCode): string {
  return filterToQuery(alertFilter({ country, query: typeof query === "string" ? query.slice(0, 500) : "" }));
}

/** The conditions as the job list shows them (地区、行业、签证 …); empty for every new job. */
export function alertConditions(alert: StoredAlert, lang: Lang = DEFAULT_LANG): string[] {
  return filterChips(alertFilter(alert), lang).map((chip) => chip.label);
}

/** The name an alert starts with: its conditions (a keyword without its quote marks), shortened to fit. */
export function defaultAlertName(alert: StoredAlert, lang: Lang = DEFAULT_LANG): string {
  const t = pick(seekerMeMessages, lang).alerts;
  const name = alertConditions(alert, lang)
    .map((label) => label.replace(/^“(.*)”$/, "$1"))
    .join(t.nameJoin);
  if (!name) return t.allJobs;
  return name.length > ALERT_NAME_MAX ? `${name.slice(0, ALERT_NAME_MAX - 1)}…` : name;
}

/** A name typed by the user: one line, at most ALERT_NAME_MAX characters; undefined when nothing is left. */
export function cleanAlertName(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const name = input.replace(/\s+/g, " ").trim().slice(0, ALERT_NAME_MAX).trim();
  return name || undefined;
}

/** A job found by an alert is one notification per account and job (the hits table has one row for that pair). */
export function alertNotificationId(jobId: string): string {
  return `alert:${jobId}`;
}
