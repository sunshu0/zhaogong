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
    task_scam: (words: string) => `含有${words}：刷单、垫付返利这类「任务」不是工作，不能发布。`,
    ethnic_preference: (words: string) =>
      `含有${words}：不能按种族或国籍招人。如果需要中文能力，请改写为「需会普通话」或「需会粤语」。`,
    high_risk: (words: string) => `含有${words}：这类职位需要人工审核，审核通过后才会公开。`,
  },
};

export const complianceMessages: Dictionary<typeof complianceZh> = { key: "compliance", zh: complianceZh };
