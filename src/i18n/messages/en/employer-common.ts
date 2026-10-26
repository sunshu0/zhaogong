// The English side of employer-common.ts (#240): the browser loads it on English pages only (src/i18n/english.ts).
// Typed by the Chinese side: a missing key, an extra key or a different parameter fails tsc.

import type { Messages } from "@/i18n/messages";
import type { employerCommonMessages } from "@/i18n/messages/employer-common";

export const employerCommonEn: Messages<(typeof employerCommonMessages)["zh"]> = {
  gate: {
    needsEmployer: "Posting and managing jobs needs the employer role. Taking you there now…",
    noRedirect: "Nothing happening? Tap here",
    seekerNow: "You are using your job seeker role. Posting and managing jobs needs your employer role.",
    switchToEmployer: (business) => `Switch to employer (${business})`,
  },

  home: {
    title: "Post a job as an employer",
    description:
      "Paste a job message and get a Chinese and English job post in a minute, checked against the rules before it goes live.",
    heading: "Hire Chinese-speaking staff: post a job in a minute",
    points: [
      "Paste a job message from a WeChat group and get a job post in Chinese and English",
      "Checks the adult minimum wage and words against the rules before you post, so job seekers can trust it",
      "Copy it to Skykiwi, Xiaohongshu and WeChat groups in one tap, with a link to the job",
    ],
    cta: "Post a job in a minute",
    ctaNote: "Set up hiring with your email. No password needed, and you can start writing straight away.",
    linksLabel: "For employers",
    jobsLink: "My jobs",
    jobsDetail: "Edit, move to top, close",
    verifyLink: "Business verification",
    verifyDetail: 'Show the "Verified business" badge',
  },

  errors: {
    signedOut: "Sign in first.",
    noIdentity: "Set up hiring first.",
    banned: "This account is suspended, so it can no longer change jobs.",
    tempBanned: (until, reason) =>
      `Your business is restricted until ${until}. Reason: ${reason}. Until then it can't post or change jobs or send messages; it ends by itself.`,
    jobNotFound: "That job can't be found.",
    alreadyEnded: "This job has already ended or been taken down.",
    hiresAfterEnd: "You can record how many people you hired once the job has ended.",
    failsRulesNow: "This job does not meet the current posting rules. Edit it first.",
    cannotRefresh: (reason) => `Can't move it to the top: ${reason}`,
    cannotRenew: (reason) => `Can't renew it: ${reason}`,
    chooseRenewDays: "Choose 14, 30 or 60 days.",
    renewTooLong: (days) =>
      days === 1
        ? "Renewing for 1 day goes past the latest closing date. Choose a shorter one."
        : `Renewing for ${days} days goes past the latest closing date. Choose a shorter one.`,
    takenDown: "This job has been taken down, so it can't be changed.",
    notReady: "Some problems are not fixed yet, or a required field is empty.",
    verifyPending: "You already have a verification application under review. A moderator will let you know.",
    verifyNzbnPending:
      "There is already a verification application under review for this NZBN. If it is your business, contact us.",
    verifyNzbnTaken: "Another business is already verified with this NZBN. If it is your business, contact us.",
    verifyBanned: "This account is suspended, so it cannot apply for verification.",
    verifyAdminOnly: "Only a team admin can apply for business verification. Ask an admin of your business.",
    verifyAlready: (badge) => `Your business is already "${badge}".`,
    verifyNzbnNotFound: "That NZBN is not in the business register.",
    verifyNzbnRemoved: "This business is removed from the business register, so it can't be used for verification.",
  },

  load: {
    jobs: "your jobs",
    job: "this job",
    applicants: "the applicants",
    stats: "this job's numbers",
    team: "your team",
    verification: "your business verification",
    candidates: "the candidates with accounts",
  },

  loading: {
    employer: "Loading",
  },
};
