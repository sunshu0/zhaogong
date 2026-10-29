// The English side of admin-stats.ts (#240): the browser loads it on English pages only (src/i18n/english.ts).
// Typed by the Chinese side: a missing key, an extra key or a different parameter fails tsc.

import type { Messages } from "@/i18n/messages";
import type { adminStatsMessages } from "@/i18n/messages/admin-stats";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const adminStatsEn: Messages<(typeof adminStatsMessages)["zh"]> = {
  name: "moderation stats",
  now: {
    label: "Moderation stats: now",
    jobs: "Jobs waiting for review",
    reports: "Reports not dealt with",
    verifications: "Business verifications waiting",
    external: "External jobs waiting for review",
    oldestWaited: (wait) => `Oldest waiting ${wait}`,
    noneWaiting: "None waiting",
  },
  weeks: {
    title: (weeks) => `Last ${weeks} weeks`,
    description:
      "New Zealand time, weeks from Monday. Handled: reports closed by a take-down, a dismissal or a ban; time is the median from report to close. Taken down includes jobs taken down with a ban.",
    caption: (weeks) =>
      `New reports, handled reports, median time to handle, jobs taken down and businesses banned, each week for the last ${weeks} weeks`,
    week: "Week",
    newReports: "New reports",
    handled: "Handled",
    time: "Time",
    takenDown: "Taken down",
    banned: "Banned",
    thisWeek: "This week",
    weekOf: (start) => `From ${start}`,
    untimed: (n) =>
      n === 1
        ? "1 more report was handled before handling times were recorded, so it isn't counted in the time."
        : `${n} more reports were handled before handling times were recorded, so they aren't counted in the time.`,
  },
  byModerator: {
    title: "By moderator",
    description: (weeks) =>
      `What each moderator did in the last ${weeks} weeks. A ban counts once, however many jobs it took down.`,
    none: (weeks) => `Nothing in the log for the last ${weeks} weeks.`,
    caption: (weeks) =>
      `Approvals, take-downs, dismissals, bans and business verifications by each moderator in the last ${weeks} weeks`,
    moderator: "Moderator",
    approve: "Approved",
    takeDown: "Taken down",
    dismiss: "Dismissed",
    ban: "Banned",
    verify: "Verification",
    external: "External jobs",
    photo: "Shop photos",
    total: "Total",
  },
  ai: {
    title: "Post with AI: usage",
    description: (days) =>
      `Calls to the model from posting by chat over the last ${days} days, New Zealand time. Tokens count input, output and cache; failed means an error, a refusal or an answer that couldn't be read; limited means stopped by the cap of 6 a minute and 100 a day per account, without calling the model.`,
    caption: (days) =>
      `Calls to the Post with AI model, tokens, failures and limited calls each day for the last ${days} days`,
    date: "Date",
    calls: "Calls",
    tokens: "Tokens",
    failed: "Failed",
    limited: "Limited",
    today: "Today",
    total: (days) => `${days}-day total`,
  },
  funnels: {
    title: "Funnels",
    description:
      "By New Zealand day: a visitor's steps on the same day are joined up, not across days. Counts are visitors, once a day. Counts of 1 to 4 show as 'fewer than 5'; a rate is the share of the first step, shown only when both counts are 5 or more. The data stays in our own database, with no accounts or emails.",
    name: "funnels",
    period: "Period",
    lastDays: (n) => `Last ${n} days`,
    breakdown: "Split by",
    breakdowns: { all: "All", lang: "By language", role: "By identity" },
    groups: {
      all: "Visitors",
      zh: "Chinese pages",
      en: "English pages",
      out: "Signed out",
      seeker: "Job seekers",
      employer: "Employers",
    },
    step: "Step",
    few: "fewer than 5",
    rate: (n) => `${n}%`,
    caption: (flow, days) => `${flow}: visitors at each step in the last ${days} days`,
    flows: {
      seek: "Job seekers: from a job to the employer",
      external: "Job seekers: external jobs",
      post: "Employers: posting a job",
      signin: "Sign-in",
    },
    steps: {
      seek: ["Home or job list", "Opened a job", "Started a chat"],
      external: ["Internship or professional list", "External job page", "Apply on the company's site"],
      post: ["Opened the posting page", "Chose a way to post", "Reached the check", "Published"],
      signin: ["Opened sign-in", "Code sent", "Signed in"],
    },
    singlesTitle: "On their own",
    singles: { jobs_search: "Used the job filters", applicants_view: "Employers looked at applicants" },
  },
  wait: {
    underAMinute: "under a minute",
    minutes: (n) => plural(n, "minute", "minutes"),
    hours: (n) => plural(n, "hour", "hours"),
    days: (n) => plural(n, "day", "days"),
    daysHours: (days, hours) => `${plural(days, "day", "days")} ${plural(hours, "hour", "hours")}`,
  },
};
