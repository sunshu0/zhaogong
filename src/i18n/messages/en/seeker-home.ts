// The English side of seeker-home.ts (#240): the browser loads it on English pages only (src/i18n/english.ts).
// Typed by the Chinese side: a missing key, an extra key or a different parameter fails tsc.

import type { Messages } from "@/i18n/messages";
import type { seekerHomeMessages } from "@/i18n/messages/seeker-home";

export const seekerHomeEn: Messages<(typeof seekerHomeMessages)["zh"]> = {
  title: "Chinese-speaking jobs in Auckland",
  description:
    "Pay, area and visas at a glance. Employers are verified, and every job is checked for the minimum wage and illegal fees before it's posted. Contact details go only to signed-in job seekers, or are swapped in chat once both sides agree.",
  hero: {
    line1: "Chinese-speaking jobs in Auckland,",
    line2: "with the pay up front.",
    lead: "Hospitality, retail, cleaning, renovation. Every job is checked against the minimum wage before it's posted, and it says clearly whether the employer is verified and which visas they accept.",
    searchPlaceholder: "Waiter, chef, Mt Eden…",
    search: "Search jobs",
    submit: "Find jobs",
    quick: "Quick filters",
    quickStudent: "Student visa holders welcome",
    quickMeals: "Meals provided",
    quickPartTime: "Part-time",
    quickCbd: "Auckland CBD",
    externalBefore: "Looking for software or electrical and electronic work? See",
    internships: "Internships",
    and: "and",
    professional: "Professional jobs",
    externalAfter: " (from company sites)",
  },
  counts: {
    openJobs: (n) => (n === 1 ? "open job, from" : "open jobs, from"),
    verifiedEmployers: (n) => (n === 1 ? "verified employer" : "verified employers"),
    employersPosting: (n) => (n === 1 ? "employer has posted jobs" : "employers have posted jobs"),
    jobsPosted: (n) => (n === 1 ? "job posted" : "jobs posted"),
    hiresConfirmed: (n) => (n === 1 ? "person found work here" : "people found work here"),
    contactViews: (n) =>
      n === 1 ? "time a job seeker contacted an employer" : "times job seekers contacted an employer",
  },
  stats: "On 找工",
  demoData: "Demo data",
  featured: {
    title: "Featured jobs",
    hint: "Open jobs from verified employers, highest pay first.",
    all: "See all jobs →",
    browseAll: "Browse all jobs →",
    loading: "Loading featured jobs",
    auckland: "Auckland",
  },
  features: {
    title: "What 找工 does",
    aiTitle: "Post with AI",
    aiText:
      "An employer pastes a WeChat hiring message, and the posting assistant asks what's missing — pay, area, hours, visas, contact — one question at a time. It points out anything not allowed and helps fix it.",
    checksTitle: "Checks before posting",
    checksText:
      "Jobs below the minimum wage can't be posted. Deposits, placement fees, offers to arrange a visa and Chinese-only hiring are blocked or have to be reworded.",
    trustTitle: "Verified employers, fewer scams",
    trustText:
      "Employers whose business registration we've checked carry a badge. Contact details go only to signed-in people, or are swapped in chat once both sides agree. Every job can be reported, and a person reviews it.",
    chineseTitle: "Chinese first",
    chineseText:
      "Pages in Chinese and English, jobs in both. Browsing, signing up and contacting employers are free for job seekers.",
  },
  replay: {
    assistant: "找工 posting assistant",
    tag: "A real chat, replayed",
    fromAssistant: "Assistant: ",
    fromEmployer: "Employer: ",
    again: "Play again",
  },
  beforeAfter: {
    before: "Before · a message in a WeChat group",
    after: "After · the job 找工 made of it, in Chinese and English",
    languages: (list) => `Languages at work: ${list}`,
    listJoin: ", ",
    contact: "Contact details: shown after you sign in",
    caption: "A WeChat hiring message that 找工 turned into a job in Chinese and English",
  },
  window: {
    label: "Hiring now",
    stamp: "招",
  },
  employers: {
    eyebrow: "For employers",
    title: "Hiring? Post a job in a minute",
    pointPaste: "Paste a hiring message from a WeChat group and it becomes a job in Chinese and English",
    pointChecks: "The minimum wage and wording that isn't allowed are checked before you post",
    pointShare: "Copy it to WeChat groups, Xiaohongshu and Skykiwi in one tap",
    signUp: "Sign up as an employer →",
    whatTheyCanDo: "See what employers can do",
  },
};
