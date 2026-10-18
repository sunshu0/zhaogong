// Round 20 (ADR 0023): the pre-publish rule check. Covers the rule texts of lib/compliance/rules.ts and
// lib/compliance/check.ts. The matched words themselves are what the employer wrote and stay as they are; only the
// wording around them is here. The chat reminders built on the same rules live in chat.ts (chat-warnings.ts).
// Facts only: no legal or visa advice.
import type { Dictionary } from "@/i18n/messages";

const complianceZh = {
  /** How a matched word is shown inside a message, and what goes between several of them. */
  words: {
    quote: (word: string) => `「${word}」`,
    joiner: "",
  },

  /** check.ts: the two rules that are not word lists. */
  minWage: {
    /** The pay and the wage come formatted with their symbol (i18n/format.ts), the date as the config writes it. */
    message: (pay: string, country: string, wage: string, from: string) =>
      `时薪 ${pay} 低于${country}成人最低工资 ${wage}（${from} 起），请调高后再发布。`,
  },
  aewvUnaccredited: {
    message: "只有认证雇主（Accredited Employer）才能招「持 AEWV 工签者」。请在签证里去掉这一项。",
  },

  /** rules.ts: one message per word rule; `words` is the matched words, already quoted and joined. */
  rules: {
    fee: (words: string) => `含有${words}：招聘不能向求职者收取押金、介绍费或任何费用，请删除。`,
    visa_selling: (words: string) => `含有${words}：不能出售或承诺办理签证。签证一栏只写接受哪些签证。`,
    ethnic_preference: (words: string) =>
      `含有${words}：不能按种族或国籍招人。如果需要中文能力，请改写为「需会普通话」或「需会粤语」。`,
    high_risk: (words: string) => `含有${words}：这类职位需要人工审核，审核通过后才会公开。`,
  },
};

export const complianceMessages: Dictionary<typeof complianceZh> = {
  zh: complianceZh,
  en: {
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
        "Only an accredited employer can hire AEWV holders (Accredited Employer Work Visa). Remove it from the visas you accept.",
    },

    rules: {
      fee: (words) =>
        `Contains ${words}: a job cannot ask job seekers for a deposit, a placement fee or any other fee. Remove it.`,
      visa_selling: (words) =>
        `Contains ${words}: you cannot sell a visa or promise to arrange one. The visa field only says which visas you accept.`,
      ethnic_preference: (words) =>
        `Contains ${words}: you cannot hire by race or nationality. If the job needs Chinese, say that it needs Mandarin or Cantonese instead.`,
      high_risk: (words) => `Contains ${words}: a job like this is checked by a person and only shows once approved.`,
    },
  },
};
