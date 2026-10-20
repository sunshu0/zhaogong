// The English side of employer-jobs.ts (#240): the browser loads it on English pages only (src/i18n/english.ts).
// Typed by the Chinese side: a missing key, an extra key or a different parameter fails tsc.

import type { Messages } from "@/i18n/messages";
import type { employerJobsMessages } from "@/i18n/messages/employer-jobs";

export const employerJobsEn: Messages<(typeof employerJobsMessages)["zh"]> = {
  pageTitles: {
    manage: "My jobs",
    stats: "Job stats",
  },

  manage: {
    heading: "My jobs",
    postNew: "Post a new job",
    searchLabel: "Search job titles",
    searchPlaceholder: "Search job titles",
    tabsLabel: "By status",
    tabs: {
      all: "All",
      active: "Open",
      ending: "Closing soon",
      pendingReview: "Under review",
      timedOut: "Closed",
      closed: "Ended",
      removed: "Taken down",
    },
    banned: "This employer account is suspended. All its jobs are taken down and it cannot post again.",
    loading: "Loading jobs",
    noticeSeparator: ": ",
    noneYet: "You haven't posted a job yet.",
    noneInTab: "No jobs with this status.",
    noMatch: (query) => `No jobs with “${query}” in the title.`,
    noMatchInTab: (query) => `No jobs with this status have “${query}” in the title.`,
  },

  job: {
    editContact: "Edit contact details",
    last14Days: "Last 14 days",
    renewedTimes: (n) => (n === 1 ? "Renewed once" : `Renewed ${n} times`),
    rolesTodo: "No role type picked yet, so this doesn't count towards suggested candidates.",
    rolesPick: "Pick one",
    takenDown: "This job was taken down by our moderators. Get in touch if you think this is wrong.",
    pendingReview: "It shows publicly once it's approved.",
    endingNote: (closeDate) => `Closes ${closeDate}. Renew it if you're still hiring — it keeps its place in the list.`,
    timedOutNote: (closeDate, days) =>
      days === 1
        ? `Closed ${closeDate}, so job seekers can't see it. You can still renew it for 1 more day.`
        : `Closed ${closeDate}, so job seekers can't see it. You can still renew it for ${days} more days.`,
    renew: "Renew",
    republishNoteStart: "It closed more than 14 days ago, so it can't be renewed. If you're still hiring,",
    republishNoteLink: "repost",
    republishNoteEnd: "it as a new job with the same content. It will be checked again under the current rules.",
    closeSubmit: "End hiring",
    hiresSubmit: "Save",
    renewDone: (days, closeDate) => `Renewed for ${days} days, closes ${closeDate}`,
    closeDone: "Hiring ended",
    closeDoneWithHires: (hires) => `Hiring ended, ${hires}`,
    hiresDone: (hires) => `Saved, ${hires}`,
  },

  actions: {
    moreMenuLabel: (title) => `More for: ${title}`,
    refreshDone: "Moved to the top",
    view: "View",
    edit: "Edit",
    renew: "Renew",
    republish: "Repost",
    refresh: "Move to top",
    share: "Copy a post",
    hideShare: "Hide the posts",
    copy: "Copy to a new job",
    close: "End hiring",
    recordHires: "Record how many you hired",
    correctHires: "Change how many you hired",
  },

  numbers: {
    views: (n) => (n === 1 ? "1 view" : `${n} views`),
    chats: (n) => (n === 1 ? "1 person chatted" : `${n} people chatted`),
    noChats: "Nobody has chatted yet",
    contactViews: (n) => (n === 1 ? "Contact details shown once" : `Contact details shown ${n} times`),
    contactPrivate: "Not public · swapped in chat",
    noApplicants: "People who chatted: 0",
    applicants: (n) => `People who chatted: ${n}`,
    applicantsWithNew: (total, unseen) =>
      `People who chatted: ${total} · ${unseen} new ${unseen === 1 ? "application" : "applications"}`,
  },

  status: {
    tag: {
      active: "Open",
      pendingReview: "Under review",
      expired: "Ended",
      removed: "Taken down",
      ending: "Closing soon",
      timedOut: "Closed",
    },
    expiry: {
      pendingReview: (days) => `The ${days} days start once it's approved`,
      closesToday: "Closes today",
      closesInDays: (days) => (days === 1 ? "Closes in 1 day" : `Closes in ${days} days`),
      renewableFor: (days) => (days === 1 ? "Can be renewed for 1 more day" : `Can be renewed for ${days} more days`),
      noLongerRenewable: "Can no longer be renewed",
    },
    refresh: {
      removed: "Taken down",
      pendingReview: "Can only be moved to the top once approved",
      expired: "Closed, can't be moved to the top",
      today: "Already moved to the top today",
    },
    renew: {
      removed: "Taken down",
      pendingReview: "Can only be renewed once approved",
      tooLate: (days) => `Closed more than ${days} days ago, can't be renewed`,
      farEnough: (days) => `A job can close at most ${days} days from now, so there's no need to renew`,
    },
  },

  hires: {
    question: (product) => `Did you hire anyone through ${product}?`,
    optional: "(you can skip this)",
    hired: "Yes, I hired someone",
    none: "No / not sure",
    countLabel: "How many you hired",
    countOption: (n) => (n === 1 ? "1 person" : `${n} people`),
    why: (product) => `This is only used to count how many people ${product} has helped find work.`,
    cancel: "Cancel",
    chooseAnswer: "Choose “Yes, I hired someone” or “No / not sure”.",
    countRange: (max) => `Enter a number from 1 to ${max}.`,
    hiredCount: (n) => (n === 1 ? "Hired 1 person" : `Hired ${n} people`),
    noneHired: (product) => `Nobody hired through ${product}`,
  },

  renew: {
    question: "Renew for how long?",
    days: (days) => (days === 1 ? "1 day" : `${days} days`),
    closesOn: (closeDate) => `· closes ${closeDate}`,
    note: (latestDays) =>
      `The closing date moves back and the job keeps its place in the list; at most ${latestDays} days from now. It is checked again under the current rules before it is renewed.`,
    submit: "Renew",
    cancel: "Cancel",
  },

  poster: {
    you: "Posted by you",
    teammate: (name) => `Posted by ${name}`,
    left: (email) => `Posted by ${email} (no longer in the team)`,
    deleted: "Posted by a deleted account",
    staleContact: (who) =>
      `The contact details were filled in by ${who}, so job seekers may not reach anyone. Change them to whoever is hiring now.`,
    staleFromLeft: (email) => `${email}, who has left the team`,
    staleFromDeleted: "a deleted account",
  },

  stats: {
    back: "← My jobs",
    heading: "Job stats",
    subtitleRest: " · last 14 days",
    notFound: "This job doesn't exist, or it doesn't belong to the business you're signed in as.",
    backToManage: "Back to my jobs",
    totals: { views: "Views", chats: "Chats started", contactViews: "Contact details shown" },
    funnelTitle: "From chat to hire",
    funnelDescription:
      "Since the job was posted. Chatted includes those who applied before; interviews don't count cancelled ones; hires are the people you marked as hired.",
    funnel: { applied: "Chatted", interviewed: "Interviews", hired: "Hired" },
    byDayTitle: "Day by day",
    byDayDescription:
      "Views: one browser counts once a day. Chats started: a job seeker's first message about this job.",
    tableCaption: "Views, chats started and contact details shown for each of the last 14 days",
    columns: { day: "Date", views: "Views", chats: "Chats", contact: "Contact" },
    contactPrivateNote: "This job doesn't show contact details publicly; they're swapped in chat.",
  },

  duplicate: {
    andMore: (n) => (n === 2 ? " and 1 other" : ` and ${n - 1} others`),
    pendingReview: " (under review)",
    closesOn: (closeDate) => ` (closes ${closeDate})`,
    noteBefore: "You already have “",
    noteAfter: (when, andMore) =>
      `” open${when}${andMore}. To hire a few more people, just renew or edit that one; if this really is a different job (another shop, another shift), post it as usual.`,
    link: "Go and look at it",
  },

  reminders: {
    type: "Hiring",
    endingTitle: (title, untilClose) => `“${title}” — ${untilClose}`,
    endingDetail: "Renew it if you're still hiring, or end hiring if you've found someone",
    timedOutTitle: (title) => `“${title}” has closed`,
    timedOutDetail: (days) =>
      days === 1
        ? "You can renew it for 1 more day; after that you can only repost it"
        : `You can renew it for ${days} more days; after that you can only repost it`,
  },

  share: {
    heading: "Post it elsewhere",
    tabsLabel: "Platform",
    platforms: { wechat: "WeChat group", xiaohongshu: "Xiaohongshu", skykiwi: "Skykiwi" },
    hints: {
      wechat: "Short, so a group can read it at a glance.",
      xiaohongshu: "The first line is the title; the hashtags go at the end.",
      skykiwi: "A forum post, with the full details in Chinese and English.",
    },
    contactPublicNote: "The post has no contact details; job seekers follow the link to see them.",
    contactPrivateNote: "The post has no contact details; job seekers follow the link and chat with you.",
    textLabel: (platform) => `${platform} post`,
    copyLabel: (platform) => `Copy the ${platform} post`,
  },
};
