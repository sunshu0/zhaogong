import { describe, expect, it } from "vitest";
import { EMPTY_RESUME } from "@/lib/candidate-matching";
import { candidateFacts } from "./candidate-facts";

describe("candidateFacts", () => {
  it("gives the five facts in the fixed order, empty ones without a value", () => {
    const facts = candidateFacts({ availability: "", location: "", languages: "" });
    expect(facts.map((fact) => fact.term)).toEqual(["可上班时间", "地区", "期望时薪", "语言", "经验"]);
    expect(facts.every((fact) => fact.value === undefined)).toBe(true);
  });

  it("combines times with weekly hours, prefers chosen regions and formats pay and experience", () => {
    const facts = candidateFacts({
      availability: "周一至周六下午",
      location: "奥克兰 · 北岸",
      languages: "普通话、英语",
      resume: {
        ...EMPTY_RESUME,
        hoursPerWeek: { min: 15, max: 25 },
        regionIds: ["akl-northcote"],
        expectedMinPay: 25,
        experienceYears: 2,
      },
    });
    expect(Object.fromEntries(facts.map((fact) => [fact.term, fact.value]))).toEqual({
      可上班时间: "周一至周六下午 · 每周 15–25 小时",
      地区: "Northcote",
      期望时薪: "$25 起 / 小时",
      语言: "普通话、英语",
      经验: "2 年相关经验",
    });
  });

  it("falls back to the free-text location and says when there is no experience", () => {
    const facts = candidateFacts({
      availability: "",
      location: "奥克兰 · 北岸",
      languages: "",
      resume: { ...EMPTY_RESUME, experienceYears: 0 },
    });
    expect(facts[1].value).toBe("奥克兰 · 北岸");
    expect(facts[4].value).toBe("暂无相关经验");
  });
});
