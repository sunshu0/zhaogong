// The English side of compliance.ts (#240): the browser loads it on English pages only (src/i18n/english.ts).
// Typed by the Chinese side: a missing key, an extra key or a different parameter fails tsc.

import type { Messages } from "@/i18n/messages";
import type { complianceMessages } from "@/i18n/messages/compliance";

export const complianceEn: Messages<(typeof complianceMessages)["zh"]> = {
  words: {
    quote: (word) => `"${word}"`,
    joiner: ", ",
  },

  minWage: {
    message: (pay, country, wage, from) =>
      `Pay of ${pay} an hour is below the adult minimum wage in ${country}, which is ${wage} an hour from ${from}. Raise the pay before you post.`,
  },
  aewvUnaccredited: {
    message:
      "Only an accredited employer can hire Accredited Employer Work Visa (AEWV) holders. Remove AEWV holders from the visas you accept.",
  },

  rules: {
    fee: (words) =>
      `Contains ${words}: a job cannot ask job seekers for a deposit, a placement fee or any other fee. Remove it.`,
    visa_selling: (words) =>
      `Contains ${words}: you cannot sell a visa or promise to arrange one. The visa field only says which visas you accept.`,
    task_scam: (words) =>
      `Contains ${words}: order brushing, fake reviews and tasks paid in advance are not jobs and cannot be posted.`,
    ethnic_preference: (words) =>
      `Contains ${words}: you cannot hire by race or nationality. If the job needs Chinese, say that it needs Mandarin or Cantonese instead.`,
    high_risk: (words) => `Contains ${words}: a job like this is checked by a person and only shows once approved.`,
  },
};
