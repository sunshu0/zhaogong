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
      "入职费",
      "岗位费",
      // #384: asking for money before the job starts, without naming a fee. Not 先付钱 or 先转账: the employer
      // paying the worker says the same words.
      "先交钱",
      "deposit",
      "bond",
      "placement fee",
      "agency fee",
      "agent fee",
      "job fee",
      "joining fee",
      "registration fee",
      "training fee",
      "uniform fee",
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
      // #384: charging the worker for the employer's sponsorship of a work visa is selling it. Only with who pays:
      // 担保费用由公司承担 and "we pay the sponsorship fee" are the employer bearing it, as it should.
      "交担保费",
      "付担保费",
      "收担保费",
      "担保费自理",
      "担保费用自理",
      "担保费由你",
      "办签费",
      "visa guaranteed",
      "guaranteed visa",
      "visa guarantee",
      "sell visa",
      "selling visa",
      "visa for sale",
      "you pay for sponsorship",
      "you pay for the sponsorship",
      "you pay the sponsorship fee",
      "pay us for sponsorship",
      "pay us for the sponsorship",
    ],
  },
  {
    // #384: 刷单 and its kind, the "job" that is a task scam: the worker pays in first and is promised it back.
    rule: "task_scam",
    level: "block",
    words: [
      "刷单",
      "刷好评",
      "刷信誉",
      "刷销量",
      "点赞返现",
      "做任务返佣",
      "做单返利",
      "垫付返款",
      "垫付返利",
      // Not "brushing" alone: brushing floors is cleaning work.
      "order brushing",
      "brushing orders",
      "fake reviews",
      "click farm",
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
