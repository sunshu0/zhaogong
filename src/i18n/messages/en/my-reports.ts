// The English side of my-reports.ts (S2, #390): the browser loads it on English pages only (src/i18n/english.ts).
// Typed by the Chinese side: a missing key, an extra key or a different parameter fails tsc.

import type { Messages } from "@/i18n/messages";
import type { myReportsMessages } from "@/i18n/messages/my-reports";

export const myReportsEn: Messages<(typeof myReportsMessages)["zh"]> = {
  title: "My reports",
  intro:
    "Only the reports sent from this device are listed here. On another device, or after clearing this browser's data or its visitor cookie, earlier reports are not shown, or show as closed.",
  jobs: "Job reports",
  noJobs: "No jobs have been reported from this device.",
  open: "Being handled",
  closed: "Closed (handled, or a moderator found no problem)",
  checking: "Checking…",
  unknown: "Can't check right now. Try again later.",
  chats: "Reports in chats",
  chatsNote: "Kept in your own chat records only; not sent to 找工 yet.",
  chatAbout: (name) => `Reported ${name}`,
  guide: "Staying safe: common job scams and what to do",
};
