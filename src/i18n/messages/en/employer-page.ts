// The English side of employer-page.ts (#240): the browser loads it on English pages only (src/i18n/english.ts).
// Typed by the Chinese side: a missing key, an extra key or a different parameter fails tsc.

import type { Messages } from "@/i18n/messages";
import type { employerPageMessages } from "@/i18n/messages/employer-page";

export const employerPageEn: Messages<(typeof employerPageMessages)["zh"]> = {
  employerPage: {
    readOnlyNote: (admins) =>
      `Only an admin${admins.length ? ` (${admins.join(", ")})` : ""} can change the Business page. This is what job seekers see now. Your own contact details for swapping are still yours to fill in.`,
  },

  pageCheck: {
    fieldLabel: {
      name: "Business name",
      headline: "Hiring summary",
      bio: "About the business",
      location: "Area",
      contactName: "Contact person",
      languages: "Languages",
      availability: "Contact time",
    },
    rule: {
      fee: "You can't charge job seekers a deposit, a finder's fee or any other fee. Please take it out.",
      visa_selling: "You can't sell a visa or promise to arrange one. Please take it out.",
      ethnic_preference:
        "You can't hire by race or nationality. If you need Chinese, write “Mandarin needed” or “Cantonese needed”.",
    },
    matchedWords: (words) => words.map((word) => `“${word}”`).join(", "),
    ruleFinding: (field, words, advice) => `${field} has ${words}: ${advice}`,
    contactList: (contacts) => contacts.join(", "),
    contactFinding: (field, contacts) =>
      `${field} has contact details (${contacts}). The Business page can be seen without signing in, so contact details go on the job only: public to signed-in job seekers, or swapped in a chat. Please take them out.`,
  },
};
