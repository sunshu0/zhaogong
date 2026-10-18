// Word lists for the compliance check, one list per country so a market can add or relax words
// without touching the engine. Chinese words match with spaces and filler symbols removed;
// English words match whole words, case-insensitive. The message each rule shows lives in the compliance
// dictionary (src/i18n/messages/compliance.ts, `rules.<rule>`), one per language; check.ts puts the two together.
import type { CountryCode } from "@/lib/types";
import type { FindingLevel, RuleId } from "./types";

export interface WordRule {
  rule: Exclude<RuleId, "min_wage" | "aewv_unaccredited">;
  level: FindingLevel;
  words: string[];
  /**
   * Whether a negation written right after the word clears it (押金：无, 押金全免). Only fees: 包签无忧
   * and 只招华人 无经验可 must never read as negated.
   */
  negatableAfter?: boolean;
}

const BASE_WORD_RULES: WordRule[] = [
  {
    rule: "fee",
    level: "block",
    words: [
      "押金",
      "保证金",
      "介绍费",
      "中介费",
      "买工作",
      "卖工作",
      "培训费",
      "服装费",
      "手续费",
      "报名费",
      "deposit",
      "bond",
      "placement fee",
      "agency fee",
      "agent fee",
      "job fee",
      "pay for the job",
      "buy the job",
    ],
    negatableAfter: true,
  },
  {
    rule: "visa_selling",
    level: "block",
    words: [
      "包签",
      "包工签",
      "包身份",
      "办身份",
      "包PR",
      "保移民",
      "帮办签证",
      "卖工签",
      "买工签",
      "办工签",
      "卖签证",
      "买签证",
      "包办签证",
      "包移民",
      "visa guaranteed",
      "guaranteed visa",
      "visa guarantee",
      "sell visa",
      "selling visa",
      "visa for sale",
    ],
  },
  {
    rule: "ethnic_preference",
    level: "rewrite",
    words: [
      "限华人",
      "仅限华人",
      "只要华人",
      "只招华人",
      "仅招华人",
      "华人优先",
      "优先华人",
      "优先考虑华人",
      "华裔优先",
      "亚洲人优先",
      "国人优先",
      "限中国人",
      "只要中国人",
      "只招中国人",
      "中国人优先",
      "chinese only",
      "chinese people only",
      "only chinese",
      "asians only",
      "asian only",
      "chinese preferred",
      "asian preferred",
    ],
  },
  {
    rule: "high_risk",
    level: "review",
    words: ["按摩", "陪酒", "陪聊", "夜场", "夜总会", "KTV", "massage", "karaoke", "hostess", "escort", "nightclub"],
  },
];

export const WORD_RULES: Record<CountryCode, WordRule[]> = {
  NZ: BASE_WORD_RULES,
  AU: BASE_WORD_RULES,
};
