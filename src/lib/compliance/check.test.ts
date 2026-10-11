import { describe, expect, it } from "vitest";
import { checkJob, publishDecision, type Finding, type JobDraft } from "@/lib/compliance";
import { WORD_RULES } from "@/lib/compliance/rules";
import { MOCK_JOBS } from "@/mock/data";

const clean: JobDraft = {
  titleZh: "前厅服务员",
  titleEn: "Front-of-house staff",
  industry: "hospitality",
  pay: { min: 25, max: 27 },
  descriptionZh: "负责点餐、上菜和收银。需要能用普通话和英语与顾客沟通。",
  descriptionEn: "Taking orders, serving and the till.",
};

const withZh = (descriptionZh: string): JobDraft => ({ ...clean, descriptionZh });
const withEn = (descriptionEn: string): JobDraft => ({ ...clean, descriptionEn });
const rules = (findings: Finding[]) => findings.map((f) => f.rule);

describe("checkJob: minimum wage", () => {
  it("passes every demo job", () => {
    for (const job of MOCK_JOBS) expect(checkJob(job, "NZ"), job.id).toEqual([]);
  });

  it("blocks pay below the NZ minimum wage and says what the minimum is", () => {
    const [f, ...rest] = checkJob({ ...clean, pay: { min: 22 } }, "NZ");
    expect(rest).toEqual([]);
    expect(f).toMatchObject({ level: "block", field: "pay", rule: "min_wage" });
    expect(f.message_zh).toContain("23.95");
    expect(f.message_zh).toContain("22");
  });

  it("blocks a range whose lower end is below the minimum", () => {
    expect(rules(checkJob({ ...clean, pay: { min: 20, max: 26 } }, "NZ"))).toEqual(["min_wage"]);
  });

  it("accepts pay exactly at the minimum", () => {
    expect(checkJob({ ...clean, pay: { min: 23.95 } }, "NZ")).toEqual([]);
  });

  it("says nothing about pay that is not filled in yet", () => {
    expect(checkJob({ ...clean, pay: undefined }, "NZ")).toEqual([]);
  });

  it("skips the wage rule for a market with no minimum configured", () => {
    expect(checkJob({ ...clean, pay: { min: 5 } }, "AU")).toEqual([]);
  });
});

describe("checkJob: word rules", () => {
  it("blocks fee words and names the field and the word", () => {
    const [f, ...rest] = checkJob(withZh("入职需交押金500元，包培训。"), "NZ");
    expect(rest).toEqual([]);
    expect(f).toMatchObject({ level: "block", field: "descriptionZh", rule: "fee", matches: ["押金"] });
    expect(f.message_zh).toContain("「押金」");
  });

  it("does not flag an employer saying they charge nothing", () => {
    for (const text of ["不收任何押金和介绍费。", "无押金，无中介费。", "免押金", "不需要交押金", "押金：无", "押金全免"]) {
      expect(checkJob(withZh(text), "NZ"), text).toEqual([]);
    }
  });

  it("still blocks a fee word that appears again without the negation", () => {
    const findings = checkJob(withZh("不收介绍费，但入职要交押金。"), "NZ");
    expect(findings).toHaveLength(1);
    expect(findings[0].matches).toEqual(["押金"]);
  });

  it("blocks visa selling, including 办工签", () => {
    expect(checkJob({ ...clean, titleZh: "厨师 包签" }, "NZ")).toMatchObject([
      { level: "block", field: "titleZh", rule: "visa_selling" },
    ]);
    expect(rules(checkJob(withZh("表现好可以帮办工签。"), "NZ"))).toEqual(["visa_selling"]);
    expect(checkJob(withZh("不包签，需自有合法工作签证。"), "NZ")).toEqual([]);
  });

  it("asks for a rewrite on ethnic preference and suggests a language requirement instead", () => {
    const [f] = checkJob(withZh("限华人，有经验优先。"), "NZ");
    expect(f).toMatchObject({ level: "rewrite", rule: "ethnic_preference", field: "descriptionZh" });
    expect(f.message_zh).toContain("需会普通话");
    expect(rules(checkJob(withZh("中国人优先"), "NZ"))).toEqual(["ethnic_preference"]);
    expect(checkJob(withZh("不限华人，会普通话即可。"), "NZ")).toEqual([]);
    expect(checkJob(withZh("华人老板，团队友好。"), "NZ")).toEqual([]);
  });

  it("sends high-risk categories to manual review", () => {
    expect(checkJob({ ...clean, titleZh: "KTV 服务员" }, "NZ")).toMatchObject([
      { level: "review", field: "titleZh", rule: "high_risk", matches: ["KTV"] },
    ]);
    expect(rules(checkJob(withZh("招按摩师"), "NZ"))).toEqual(["high_risk"]);
    expect(rules(checkJob(withZh("夜场陪酒"), "NZ"))).toEqual(["high_risk"]);
  });

  it("sees through full-width letters and spaces inserted between characters", () => {
    expect(rules(checkJob({ ...clean, titleZh: "ＫＴＶ招人" }, "NZ"))).toEqual(["high_risk"]);
    expect(rules(checkJob(withZh("包 签"), "NZ"))).toEqual(["visa_selling"]);
    expect(rules(checkJob(withZh("押*金 300"), "NZ"))).toEqual(["fee"]);
  });

  it("checks English text with word boundaries and English negation", () => {
    expect(rules(checkJob(withEn("A $200 deposit is required before you start."), "NZ"))).toEqual(["fee"]);
    expect(checkJob(withEn("No deposit, no fees of any kind."), "NZ")).toEqual([]);
    expect(checkJob(withEn("We never charge a placement fee."), "NZ")).toEqual([]);
    expect(rules(checkJob(withEn("Chinese only."), "NZ"))).toEqual(["ethnic_preference"]);
    expect(rules(checkJob(withEn("Experienced massage therapist wanted."), "NZ"))).toEqual(["high_risk"]);
    expect(checkJob(withEn("Wages deposited weekly."), "NZ")).toEqual([]);
  });

  it("gives one finding per rule and field, with each word listed once", () => {
    const findings = checkJob(withZh("押金300，押金不退，另收介绍费。"), "NZ");
    expect(findings).toHaveLength(1);
    expect(findings[0].matches).toEqual(["押金", "介绍费"]);
  });

  it("puts blocks first, then rewrites, then reviews", () => {
    const findings = checkJob(
      { ...clean, titleZh: "KTV 服务员", pay: { min: 20 }, descriptionZh: "只要华人，需交押金。" },
      "NZ",
    );
    expect(findings.map((f) => f.level)).toEqual(["block", "block", "rewrite", "review"]);
  });

  it("covers every word the brief lists", () => {
    const brief: Record<string, string[]> = {
      fee: ["押金", "介绍费", "买工作"],
      visa_selling: ["包签", "卖工签", "办工签"],
      ethnic_preference: ["限华人", "只要华人", "中国人优先"],
      high_risk: ["按摩", "陪酒", "KTV"],
    };
    for (const [rule, words] of Object.entries(brief)) {
      const listed = WORD_RULES.NZ.filter((r) => r.rule === rule).flatMap((r) => r.words);
      for (const word of words) {
        expect(listed, `${rule} lists ${word}`).toContain(word);
        expect(rules(checkJob(withZh(`这里有${word}。`), "NZ")), word).toEqual([rule]);
      }
    }
  });
});

describe("publishDecision", () => {
  it("holds publishing while a block or rewrite is open", () => {
    expect(publishDecision(checkJob({ ...clean, pay: { min: 20 } }, "NZ")).canPublish).toBe(false);
    expect(publishDecision(checkJob(withZh("限华人"), "NZ")).canPublish).toBe(false);
  });

  it("publishes review findings as pending review and clean jobs as active", () => {
    expect(publishDecision(checkJob(withZh("招按摩师"), "NZ"))).toEqual({ canPublish: true, status: "pending_review" });
    expect(publishDecision(checkJob(clean, "NZ"))).toEqual({ canPublish: true, status: "active" });
  });
});
