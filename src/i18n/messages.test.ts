import { readdirSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { pick, type Dictionary, type Messages } from "@/i18n/messages";

// The shape the dictionaries in src/i18n/messages/ follow (messages.ts): the Chinese side and a key, the English
// side listed under that key in messages/en/ (#240, #267). The sample's English is listed here instead: englishFor
// answers for the "test." keys and leaves every other key to the real table.
const testEnglish = vi.hoisted(() => ({}) as Record<string, unknown>);
vi.mock("@/i18n/english", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/i18n/english")>();
  return { ...real, englishFor: (key: string) => (key in testEnglish ? testEnglish[key] : real.englishFor(key)) };
});

const sampleZh = {
  save: "收藏",
  savedCount: (n: number) => `已收藏 ${n} 个`,
  steps: ["填写", "预览"],
  form: { title: "职位名称", tooLong: (max: number) => `最多 ${max} 个字` },
};
const sample: Dictionary<typeof sampleZh> = { key: "test.sample", zh: sampleZh };
const sampleEn: Messages<typeof sampleZh> = {
  save: "Save",
  savedCount: (n) => (n === 1 ? "1 saved" : `${n} saved`),
  steps: ["Fill in", "Preview"],
  form: { title: "Job title", tooLong: (max) => `${max} characters at most` },
};
testEnglish["test.sample"] = sampleEn;

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
    // Each marked line must fail `tsc` (npm run typecheck); the directive itself fails if it ever compiles. The
    // English files in messages/en/ are typed Messages<(typeof …)["zh"]>, as these are.
    // @ts-expect-error a key is missing in English
    const missing: Messages<{ save: string; saved: string }> = { save: "Save" };
    const extra: Messages<{ save: string }> = {
      save: "Save",
      // @ts-expect-error a key English has and Chinese does not
      saveAll: "Save all",
    };
    const wrongParameter: Messages<{ count: (n: number) => string }> = {
      // @ts-expect-error English takes a different parameter
      count: (n: string) => n,
    };
    const notWording: Messages<{ count: (n: number) => string }> = {
      // @ts-expect-error English must be wording too, not a number
      count: (n: number) => n,
    };
    expect([missing, extra, wrongParameter, notWording]).toHaveLength(4);
  });

  it("are checked by tsc: the English side is never written in the dictionary itself (#267)", () => {
    // Inline it would go into every page's JavaScript, Chinese pages included.
    const inline: Dictionary<{ save: string }> = {
      key: "test.inline",
      zh: { save: "收藏" },
      // @ts-expect-error English belongs in messages/en/, listed under the key
      en: { save: "Save" },
    };
    expect(inline.key).toBe("test.inline");
  });
});

// The dictionary modules, loaded once for the test below (#240).
const files = readdirSync("src/i18n/messages").filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
const modules: [string, Record<string, unknown>][] = await Promise.all(
  files.map(
    async (f) => [f, await import(`./messages/${f.replace(/\.ts$/, "")}.ts`)] as [string, Record<string, unknown>],
  ),
);

describe("the English sides kept apart (#240)", () => {
  // Every dictionary in src/i18n/messages/ has its English listed in en/index.ts under its key, so pick(…, "en")
  // never throws on a page.
  const dictionaries = modules.flatMap(([file, exports]) =>
    Object.entries(exports)
      .filter(([, value]) => typeof value === "object" && value !== null && "zh" in value)
      .map(([name, value]) => [`${file} ${name}`, value as Dictionary<object>] as const),
  );

  it("finds the dictionaries", () => {
    expect(dictionaries.length).toBeGreaterThan(20);
  });

  for (const [name, dictionary] of dictionaries)
    it(`${name} has its English side`, () => {
      expect(() => pick(dictionary, "en")).not.toThrow();
      expect(Object.keys(pick(dictionary, "en"))).toEqual(Object.keys(dictionary.zh));
    });

  it("keys are unique, so no two dictionaries share an English side", () => {
    const keys = dictionaries.map(([, d]) => d.key).filter(Boolean);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
