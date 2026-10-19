// The English side of ui.ts (#240): the browser loads it on English pages only (src/i18n/english.ts).
// Typed by the Chinese side: a missing key, an extra key or a different parameter fails tsc.

import type { Messages } from "@/i18n/messages";
import type { uiMessages } from "@/i18n/messages/ui";

const jobsIn = (n: number, industry: string) => `${n} open ${industry} ${n === 1 ? "job" : "jobs"} on 找工`;

export const uiEn: Messages<(typeof uiMessages)["zh"]> = {
  nav: {
    jobs: "Jobs",
    findJobs: "Find jobs",
    chat: "Chat",
    chatUnread: (n) => `Chat, ${n} unread ${n === 1 ? "message" : "messages"}`,
    mine: "Me",
    manage: "My jobs",
    post: "Post",
    candidates: "Suggested candidates",
    workspace: "Workspace",
    main: "Main navigation",
    bottom: "Bottom bar",
    more: "More",
  },
  close: "Close",
  closeDialog: "Close the dialog",
  any: "Any",
  copy: "Copy",
  copied: "Copied",
  copyFailed: "Couldn't copy",
  print: "Print / save as PDF",
  signIn: "Sign in or sign up",
  langSwitch: {
    other: "中文",
    otherTag: "zh-CN",
    title: "Switch to Chinese",
    row: "Language: English",
    noAnswer: "Network problem: the language didn't change. Try again later.",
  },
  loading: "Loading",
  loadingJobs: "Loading jobs",
  verification: {
    accredited_employer:
      "New Zealand business registration checked, and an Immigration NZ accredited employer (Accredited Employer).",
    business_verified: "New Zealand business registration (NZBN) checked; not an Immigration NZ accredited employer.",
    unverified: "Business registration not checked yet. Check the employer's details yourself before you contact them.",
  },
  payReference: {
    title: "Pay for similar jobs",
    tooFew: (industry, count, min) =>
      `Pay for similar jobs: too few to show (only ${jobsIn(count, industry)}, fewer than ${min}).`,
    lowest: "Lowest",
    median: "Median",
    highest: "Highest",
    basis: (count, industry, updated) =>
      `Based on ${jobsIn(count, industry)} (each job counts the middle of its pay range), no outside data. Updated ${updated}.`,
    belowMedian: "Below the median for similar jobs, so it may be harder to find someone.",
    wholeCity: (area) => `All of ${area}`,
    wholeAuckland: "All of Auckland",
  },
  site: {
    // #340 (导师 10-20, 待用户): 找工 Zhaogong, as the manifest names the app.
    name: "找工 Zhaogong",
    title: "Chinese-speaking jobs in New Zealand",
    description:
      "Jobs in Auckland for Chinese speakers: pay per hour, area and visas accepted at a glance, with verified employers.",
    city: "Auckland",
    lawNote:
      "Every job must follow New Zealand law: at least the minimum wage, no fees of any kind, and no hiring by race or nationality.",
  },
  error: {
    title: "Something went wrong on this page",
    body: "The network may be unsteady, or something went wrong on our side. Try again in a moment; if it keeps happening, tell us.",
    retry: "Try again",
    home: "Home",
    appTitle: "找工 can't open right now",
    appBody: "The network may be unsteady, or something went wrong on our side. Try again in a moment.",
  },
  notFound: {
    title: "This page doesn't exist",
    body: "The link may be wrong, or the content has been taken down.",
    findJobs: "Find jobs",
    home: "Home",
  },
  load: {
    notLoaded: (what) => `Couldn't load ${what}. The connection may have dropped.`,
    retry: "Try again",
    noAnswer: "Network problem. Try again shortly.",
  },
  consent: {
    body: "We'd like to use Microsoft Clarity to record clicks and scrolling on our pages, to make 找工 better. All text on the page and anything you type is masked, and chats, CVs and contact details are never recorded. It only starts if you agree, and the site works the same if you don't.",
    agree: "Agree",
    decline: "No thanks",
    privacy: "Privacy",
    settings: "Analytics settings",
    on: "Now: agreed.",
    off: "Now: off.",
  },
};
