// The English side of admin-views.ts (#240, #336): the browser loads it on English pages only.
// Typed by the Chinese side: a missing key, an extra key or a different parameter fails tsc.

import type { Messages } from "@/i18n/messages";
import type { adminViewsMessages } from "@/i18n/messages/admin-views";

export const adminViewsEn: Messages<(typeof adminViewsMessages)["zh"]> = {
  tab: "Access log",
  record: (id: string) => `No. ${id}`,
  name: "the access log",
  title: "Whose personal information moderators saw",
  description:
    "Each time the moderation pages hand a moderator someone's personal information (such as the contact's name and phone in a business verification), one line records which moderator, when, which kind and which record, never the information itself. Seeing the same record again within 30 minutes counts once. Lines are kept for a year.",
  moderator: "Moderator",
  everyone: "All moderators",
  period: "Period",
  lastDays: (days: number) => (days === 365 ? "Last year" : `Last ${days} days`),
  kinds: {
    verification: "Business verification",
    contact: "Job contact details",
    profile: "Job seeker profile",
    chat: "Chat",
  },
  columns: { at: "Time", moderator: "Moderator", kind: "Kind", subject: "Record" },
  caption: (count: number) => `${count} ${count === 1 ? "line" : "lines"}, newest first`,
  empty: "Nothing in this period.",
  more: (limit: number) => `Only the newest ${limit} are shown. Pick a shorter period or one moderator.`,
  evidence: {
    open: (messages: number, images: number) =>
      `See the evidence: ${[
        messages ? `${messages} chat ${messages === 1 ? "message" : "messages"}` : "",
        images ? `${images} ${images === 1 ? "screenshot" : "screenshots"}` : "",
      ]
        .filter(Boolean)
        .join(", ")}`,
    close: "Hide the evidence",
    note: "Picked by the reporter from their own chat with this business, as it read when they reported. Opening it is recorded in the access log.",
    messagesLabel: "Chat messages sent with the report",
    reporter: "Reporter",
    employer: (name: string | null) => (name ? `Employer (${name})` : "Employer"),
    screenshot: (n: number) => `Screenshot ${n}`,
    openImage: (n: number) => `Screenshot ${n} (opens the full image in a new window)`,
    none: "This report's evidence has been deleted (180 days after it was handled).",
    name: "the evidence",
  },
};
