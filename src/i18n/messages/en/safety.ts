// The English side of safety.ts (S2, #390): the browser loads it on English pages only (src/i18n/english.ts).
// Typed by the Chinese side: a missing key, an extra key or a different parameter fails tsc.

import type { Messages } from "@/i18n/messages";
import type { safetyMessages } from "@/i18n/messages/safety";

export const safetyEn: Messages<(typeof safetyMessages)["zh"]> = {
  title: "Staying safe from job scams",
  intro:
    "New to New Zealand and looking for work? These requests are the most common signs of a scam. If you see one, don't pay and don't hand over documents. Report the job (reports in a chat are only kept in your own records for now, as evidence).",
  fees: {
    heading: "Paying before you get the job",
    body: "A deposit, an introduction fee, a joining fee, a training fee or a uniform fee. A genuine employer won't ask you to pay before hiring you. Don't pay; report the job.",
  },
  visa: {
    heading: "Buying a visa or sponsorship",
    body: "Someone offers a work visa, employer sponsorship or a “guaranteed” result for a fee. Money can't buy you a job or a visa sponsorship. A licensed immigration adviser or a lawyer can charge for their services, but no one can promise a visa will be granted.",
    inz: "For visas, go by the Immigration New Zealand website",
    advisers: "Check whether an immigration adviser is licensed on the Immigration Advisers Authority website",
  },
  tasks: {
    heading: "Fake order tasks and “rebates”",
    body: "You're asked to pay first to place orders, like posts or write reviews, then promised a rebate or commission. This isn't a job, and the money you put in is usually gone.",
  },
  documents: {
    heading: "Your original passport, card PIN or one-time codes",
    body: "An employer can look at your passport or visa to check you can work in New Zealand; don't leave your original passport with them. No one needs your card PIN, your online banking login or a code sent to your phone.",
  },
  wage: {
    heading: "Pay below the minimum wage",
    body: (adult, startingOut, since) =>
      `The adult minimum wage in New Zealand is currently ${adult} an hour. Some 16 to 19 year olds and trainees can be paid the starting-out or training wage, ${startingOut} an hour (both from ${since}; who they apply to and the rates are as Employment New Zealand publishes them). If a job pays less than these, report it on 找工. For questions about pay, call Employment New Zealand on 0800 20 90 20.`,
    rates: "Employment New Zealand: minimum wage rates",
  },
  notAdvice: "This page is a reminder, not legal advice.",
};
