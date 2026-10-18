import { describe, expect, it } from "vitest";
import { pick, type Dictionary } from "@/i18n/messages";

// The shape the dictionaries in src/i18n/messages/ follow (messages.ts).
const sampleZh = {
  save: "收藏",
  savedCount: (n: number) => `已收藏 ${n} 个`,
  steps: ["填写", "预览"],
  form: { title: "职位名称", tooLong: (max: number) => `最多 ${max} 个字` },
};
const sample: Dictionary<typeof sampleZh> = {
  zh: sampleZh,
  en: {
    save: "Save",
    savedCount: (n) => (n === 1 ? "1 saved" : `${n} saved`),
    steps: ["Fill in", "Preview"],
    form: { title: "Job title", tooLong: (max) => `${max} characters at most` },
  },
};

describe("dictionaries", () => {
  it("give each language its own side, nested groups and wording with figures included", () => {
    const zh = pick(sample, "zh");
    const en = pick(sample, "en");
    expect([zh.save, zh.savedCount(3), zh.steps[1], zh.form.tooLong(40)]).toEqual([
      "收藏",
      "已收藏 3 个",
      "预览",
      "最多 40 个字",
    ]);
    expect([en.save, en.savedCount(1), en.savedCount(3), en.form.title]).toEqual([
      "Save",
      "1 saved",
      "3 saved",
      "Job title",
    ]);
  });

  it("are checked by tsc: the English side has exactly the Chinese side's keys and parameters", () => {
    // Each marked line must fail `tsc` (npm run typecheck); the directive itself fails if it ever compiles.
    const missing: Dictionary<{ save: string; saved: string }> = {
      zh: { save: "收藏", saved: "已收藏" },
      // @ts-expect-error a key is missing in English
      en: { save: "Save" },
    };
    const extra: Dictionary<{ save: string }> = {
      zh: { save: "收藏" },
      // @ts-expect-error a key English has and Chinese does not
      en: { save: "Save", saveAll: "Save all" },
    };
    const wrongParameter: Dictionary<{ count: (n: number) => string }> = {
      zh: { count: (n: number) => `${n} 个` },
      // @ts-expect-error English takes a different parameter
      en: { count: (n: string) => n },
    };
    const notWording: Dictionary<{ count: (n: number) => string }> = {
      zh: { count: (n: number) => `${n} 个` },
      // @ts-expect-error English must be wording too, not a number
      en: { count: (n: number) => n },
    };
    expect([missing, extra, wrongParameter, notWording]).toHaveLength(4);
  });
});
