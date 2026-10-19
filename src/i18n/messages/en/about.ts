// The English side of about.ts (#324): the browser loads it on English pages only (src/i18n/english.ts).
// Typed by the Chinese side: a missing key, an extra key or a different parameter fails tsc.

import type { Messages } from "@/i18n/messages";
import type { aboutMessages } from "@/i18n/messages/about";

export const aboutEn: Messages<(typeof aboutMessages)["zh"]> = {
  title: "About 找工",
  intro:
    "找工 is a Chinese-language job listings site for Chinese speakers in New Zealand, starting in Auckland: jobs in hospitality, retail, cleaning, hair and beauty, construction and renovation, warehouse and logistics and more, plus internships and professional jobs imported from company websites.",
  who: {
    heading: "Who runs it",
    body: "找工 is run by [Company name], [Company address]. 找工 only publishes job listings. It is not an employer, a recruitment agency or an immigration adviser: any employment is between you and the employer.",
  },
  cost: {
    heading: "What it costs",
    body: "找工 is free for job seekers: browsing, chatting, applying, saving jobs and alerts cost nothing. Employers can also post jobs for free at the moment.",
  },
  rules: {
    heading: "The rules every job keeps",
    intro:
      "Every job is checked automatically before it is published, and moderators act on reports. Jobs that break the rules are stopped or taken down.",
    wage: (wage, since) => `Pay is at least the legal minimum wage: for adults now ${wage} an hour (since ${since}).`,
    noFees: "No fees, deposits or bonds are asked of job seekers; jobs that ask are stopped or taken down.",
    noDiscrimination:
      "No one is picked by race, colour, ethnic or national origins, or nationality. A language the job really needs is fine, such as “must speak Cantonese”.",
    report: "If you see a job that breaks these rules, press “Report this job” on the job page.",
  },
  visa: {
    heading: "Visas and immigration",
    body: "找工 does not give visa or immigration advice. The visa line on a job only repeats what the employer or the posting says; it is not advice. For advice, see Immigration New Zealand's website or a licensed immigration adviser.",
    inz: "Immigration New Zealand",
    advisers: "Who can give immigration advice (Immigration Advisers Authority)",
  },
  external: {
    heading: "Where internships and professional jobs come from",
    body: "These jobs are imported from the public feeds of companies' hiring systems. We keep only the facts, not the posting itself, and say where and when we read them; you apply on the company's site, and 找工 never sees or handles it. When a company asks us to remove its jobs, we take them down the same day.",
  },
  data: {
    heading: "Your information",
    body: "How we collect and use your information is in our privacy statement. You can download or delete your data under Me → Data and account. Privacy officer: [Privacy officer's name or role], email: [Privacy contact email].",
    privacy: "Privacy statement",
  },
  contact: {
    heading: "Contact us",
    body: "Email: [Contact email]. For a problem with a job, press “Report this job” on the job page first: that is the quickest way.",
  },
  footer: { label: "About and legal", about: "About 找工", privacy: "Privacy", terms: "Terms of use" },
};
