import { describe, expect, it } from "vitest";
import { draftChecklist } from "@/components/employer/draft-checklist";
import type { JobDraft } from "@/lib/compliance";

const full: JobDraft = {
  country: "NZ",
  titleZh: "前厅服务员",
  titleEn: "Front-of-house staff",
  industry: "hospitality",
  employmentType: ["part_time"],
  regionId: "akl-mt-eden",
  pay: { min: 25, max: 27 },
  visaAccepted: ["student"],
  descriptionZh: "点餐、上菜。",
  descriptionEn: "Taking orders.",
};

describe("draftChecklist", () => {
  it("counts required items filled, and is ready when nothing is missing", () => {
    const c = draftChecklist(full, "NZ");
    expect(c).toMatchObject({ done: 6, total: 6, problems: 0, ready: true });
    expect(c.items.map((i) => i.label)).toEqual([
      "职位名称",
      "时薪",
      "地区",
      "工作类型",
      "签证",
      "职位描述",
      "联系方式",
      "每周工时",
      "包餐包住",
    ]);
    expect(c.items[0].value).toBe("前厅服务员 · Front-of-house staff");
    expect(c.items[1].value).toBe("$25–27/小时");
  });

  it("starts empty: nothing filled, no title to show", () => {
    const c = draftChecklist({ country: "NZ" }, "NZ");
    expect(c).toMatchObject({ done: 0, total: 6, ready: false });
    expect(c.items[0]).toMatchObject({ value: undefined, done: false, ask: "改一下职位名称" });
  });

  it("does not count a title until the English name and industry are in too", () => {
    const c = draftChecklist({ ...full, titleEn: undefined }, "NZ");
    expect(c.items[0]).toMatchObject({ value: "前厅服务员", done: false });
    expect(c.done).toBe(5);
  });

  it("asks for contact details only when they are public", () => {
    const shown = draftChecklist({ ...full, contactPublic: true }, "NZ");
    expect(shown).toMatchObject({ done: 6, total: 7, ready: false });
    expect(shown.items[6]).toMatchObject({ label: "联系方式", required: true, done: false, ask: "改一下联系方式" });
    const kept = draftChecklist(full, "NZ").items[6];
    expect(kept).toMatchObject({ value: "不公开 · 聊天交换", required: false, ask: "公开联系方式" });
  });

  it("counts the problems that hold publishing", () => {
    const c = draftChecklist({ ...full, pay: { min: 20 }, descriptionZh: "入职交押金。" }, "NZ");
    expect(c).toMatchObject({ problems: 2, ready: false });
  });

  it("marks optional items done once answered, even with 不包吃住", () => {
    const c = draftChecklist({ ...full, mealsIncluded: false, accommodationIncluded: false }, "NZ");
    expect(c.items.at(-1)).toMatchObject({ value: "不包吃住", done: true, required: false });
    expect(c.items.at(-2)).toMatchObject({ value: undefined, done: false });
  });
});
