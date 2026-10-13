// Word lists for the compliance check, one list per country so a market can add or relax words
// without touching the engine. Chinese words match with spaces and filler symbols removed;
// English words match whole words, case-insensitive.
import type { CountryCode } from "@/lib/types";
import type { FindingLevel, RuleId } from "./types";

export interface WordRule {
  rule: Exclude<RuleId, "min_wage">;
  level: FindingLevel;
  words: string[];
  /** `{words}` becomes the matched words, each in 「」. */
  message_zh: string;
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
      "deposit",
      "placement fee",
      "agency fee",
      "agent fee",
      "job fee",
      "pay for the job",
      "buy the job",
    ],
    message_zh: "含有{words}：招聘不能向求职者收取押金、介绍费或任何费用，请删除。",
  },
  {
    rule: "visa_selling",
    level: "block",
    words: [
      "包签",
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
    message_zh: "含有{words}：不能出售或承诺办理签证。签证一栏只写接受哪些签证。",
  },
  {
    rule: "ethnic_preference",
    level: "rewrite",
    words: [
      "限华人",
      "仅限华人",
      "只要华人",
      "只招华人",
      "华人优先",
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
    message_zh: "含有{words}：不能按种族或国籍招人。如果需要中文能力，请改写为「需会普通话」或「需会粤语」。",
  },
  {
    rule: "high_risk",
    level: "review",
    words: ["按摩", "陪酒", "陪聊", "夜场", "夜总会", "KTV", "massage", "karaoke", "hostess", "escort", "nightclub"],
    message_zh: "含有{words}：这类职位需要人工审核，审核通过后才会公开。",
  },
];

export const WORD_RULES: Record<CountryCode, WordRule[]> = {
  NZ: BASE_WORD_RULES,
  AU: BASE_WORD_RULES,
};
