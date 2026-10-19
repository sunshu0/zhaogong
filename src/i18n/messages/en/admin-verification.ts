// The English side of admin-verification.ts (#240): the browser loads it on English pages only (src/i18n/english.ts).
// Typed by the Chinese side: a missing key, an extra key or a different parameter fails tsc.

import type { Messages } from "@/i18n/messages";
import type { adminVerificationMessages } from "@/i18n/messages/admin-verification";

export const adminVerificationEn: Messages<(typeof adminVerificationMessages)["zh"]> = {
  listName: "business verification requests",
  empty: "No business verification waiting for review.",
  howTo:
    "Tick each item once you've checked it; every required one must be ticked to approve. Call the business on a number from a public source, not only the one the applicant gave. What you checked and your notes go into the moderation record.",
  cardLabel: (tradingName) => `Business verification: ${tradingName}`,
  applyingFor: (badge) => `Applying for ${badge}`,
  banned: "Banned",
  newWindow: " (new window)",
  submitted: (when) => `Submitted ${when}`,
  register: {
    heading: "Business register (sample register)",
    legalName: "Legal name",
    notInRegister: "This NZBN isn't in the register",
    status: "Status",
    registered: "Registered",
    removed: "Removed",
    tradingNames: "Trading names",
    list: (names) => names.join(", "),
  },
  applicant: {
    heading: "From the employer",
    company: "Business name",
    contact: "Contact",
    contactWithRole: (name, role) => `${name} (${role})`,
    phone: "Business phone",
    website: "Website",
    notGiven: "Not given",
  },
  checklist: "Checklist",
  optional: " (optional)",
  noteLabel: (item) => `Note on ${item}`,
  notePlaceholder: "Note (optional)",
  approve: "Approve",
  reject: "Reject",
  unchecked: (items) => `Not ticked yet: ${items.join(", ")}`,
  rejectLegend: "Reason for rejecting (the employer sees it)",
  rejectNote: "Details",
  confirmReject: "Yes, reject",
  errors: {
    gone: "This request has already been dealt with, or doesn't exist.",
    banned: "This business is banned and can't be verified.",
    unchecked: (items) => `Some checks aren't ticked yet: ${items.join(", ")}.`,
  },
  logApproved: (badge, nzbn) => `${badge}, NZBN ${nzbn}`,
  logRejected: (reason, note) => `${reason}: ${note}`,
};
