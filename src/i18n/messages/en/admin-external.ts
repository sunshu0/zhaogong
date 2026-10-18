// The English side of admin-external.ts (#240): the browser loads it on English pages only (src/i18n/english.ts).
// Typed by the Chinese side: a missing key, an extra key or a different parameter fails tsc.

import type { Messages } from "@/i18n/messages";
import type { adminExternalMessages } from "@/i18n/messages/admin-external";

export const adminExternalEn: Messages<(typeof adminExternalMessages)["zh"]> = {
  name: "external jobs",
  intro:
    "External jobs come in from the public feeds of companies' hiring systems. We keep only the facts, and a job shows under Internships or Professional jobs only once approved. Use “See the original posting” to compare: if a fact was read wrongly, it isn't a software or electrical and electronic role, or it asks for a nationality or race, choose “Don't show”.",
  demoJobs: (n) =>
    `${n} of these external jobs are made-up demo jobs (companies not on the list, with no real company site): the companies' sites couldn't be reached when the demo database was made, or this is test data. With a connection, run npm run import:external to import real jobs; the made-up ones come down by themselves, and new jobs show once approved here.`,
  pending: (n) => `Waiting for review ${n}`,
  noPending: "No external jobs waiting for review.",
  approvedHeading: (n) => `Approved ${n}`,
  noApproved: "No external jobs approved yet.",
  job: {
    label: (title) => `External job: ${title}`,
    byDepartment: "Placed by department",
    showing: "Showing",
    approvedHidden: "Approved, not showing for now",
    seen: (company, first, last) => `${company} · First imported ${first} · Checked on ${last}`,
    whyHidden: " (not seen in the feed for over 2 days, or past its closing date)",
    byDepartmentNote:
      "The title doesn't say whether it's software or electrical and electronic, so the field was placed by department. Check it in the original.",
    checkOriginal: "Check the original posting:",
    flagsChecked:
      "I've read the original: the role needs this by law (export controls, say); it isn't picking people by nationality or race",
    original: "See the original posting",
    hideLegend: "Why not show it",
    note: "Details",
    noteOptional: "Details (optional)",
    confirmHide: "Yes, don't show it",
    approve: "Approve",
    hide: "Don't show",
    takeOff: "Take it down",
  },
  companies: {
    title: "Companies",
    description:
      "The list is in src/config/external-companies.ts. Only companies whose terms someone has checked, and which allow showing their jobs, are imported. Stopping a company or recording a removal request takes all its jobs down at once.",
    label: (name) => `External company: ${name}`,
    importing: "Importing",
    removed: "Removed",
    stopped: "Stopped",
    counts: (pending, shown) => `Waiting ${pending} · Showing ${shown}`,
    takedownOn: (date, requester) => `Removal requested by the company (${date}): ${requester}`,
    stoppedOn: (date, note) => `Stopped (${date}): ${note}`,
    notListed: "Not on the list (demo data)",
    termsChecked: (by, on) => `Terms checked: ${by}, ${on}`,
    termsForbid: (by, on) => `The terms don't allow showing jobs (${by}, ${on})`,
    termsUnchecked: "Terms not checked yet, so nothing is imported",
    stopHeading: "Stop importing from this company",
    takedownHeading: "Record the company's removal request",
    resumeHeading: "Resume importing",
    requester: "Who asked (company email or department; nothing personal)",
    takedownNote: "What they asked and the date it came in",
    reason: "Reason",
    confirmStop: "Yes, stop and take down",
    confirmTakedown: "Record it and take everything down",
    confirmResume: "Yes, resume",
    resume: "Resume importing",
    stop: "Stop importing",
    takedown: "Removal requested by the company",
  },
  errors: {
    noJob: "We couldn't find this job.",
    alreadyApproved: "This job is already approved.",
    alreadyHidden: "This job already isn't showing.",
    noCompany: "We couldn't find this company.",
    alreadyStopped: "Importing from this company has already stopped.",
    alreadyTakenDown: "This company's removal request is already recorded.",
    notStopped: "Importing from this company hasn't been stopped.",
  },
  log: {
    flagsChecked: "Special requirements checked against the original",
    reasonWithNote: (reason, note) => `${reason}: ${note}`,
    requestBy: (requester, note) => `${requester}: ${note}`,
  },
};
