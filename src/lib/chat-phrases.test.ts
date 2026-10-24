import { describe, expect, it } from "vitest";
import {
  NO_PHRASES,
  OPENER_MAX,
  PHRASE_MAX,
  PHRASES_MAX,
  cleanOpener,
  cleanPhrases,
  fillOpener,
  openerText,
  readOpener,
  readPhrases,
  shownPhrases,
  storeOpener,
  storePhrases,
} from "@/lib/chat-phrases";
import { readContact } from "@/lib/ai-post/parse";
import { pick } from "@/i18n/messages";
import { chatMessages } from "@/i18n/messages/chat";
import { LANGS } from "@/i18n/lang";

describe("常用语 (#372, ADR 0035)", () => {
  it("are trimmed, blank ones left out, at most 10 of at most 60 characters", () => {
    expect(cleanPhrases(["  你好  ", "", "   ", "请问\n还招吗"])).toEqual({ phrases: ["你好", "请问 还招吗"] });
    expect(cleanPhrases(Array.from({ length: PHRASES_MAX }, (_, i) => `第${i}条`))).toHaveProperty("phrases");
    expect(cleanPhrases(Array.from({ length: PHRASES_MAX + 1 }, (_, i) => `第${i}条`))).toEqual({
      problem: "too_many",
    });
    expect(cleanPhrases(["好", "字".repeat(PHRASE_MAX)])).toHaveProperty("phrases");
    expect(cleanPhrases(["好", "字".repeat(PHRASE_MAX + 1)])).toEqual({ problem: "too_long", index: 1 });
    // An emoji is one character, as a person counts it.
    expect(cleanPhrases(["👍".repeat(PHRASE_MAX)])).toHaveProperty("phrases");
  });

  it("refuse anything that is not a list of strings", () => {
    for (const bad of [null, "你好", { 0: "你好" }, [1], ["好", null]]) expect(cleanPhrases(bad)).toBeUndefined();
  });

  it("are kept as JSON, null for the defaults, and anything unreadable reads as the defaults", () => {
    expect(storePhrases(null)).toBeNull();
    expect(readPhrases(storePhrases(["你好", "谢谢"]))).toEqual(["你好", "谢谢"]);
    expect(readPhrases(null)).toBeNull();
    expect(readPhrases("not json")).toBeNull();
    expect(readPhrases(JSON.stringify({ a: 1 }))).toBeNull();
  });

  it("show the identity's own list, else the defaults", () => {
    const kept = { ...NO_PHRASES, employer: ["我们还在招"] };
    expect(shownPhrases(kept, "employer", ["默认"])).toEqual(["我们还在招"]);
    expect(shownPhrases(kept, "seeker", ["默认"])).toEqual(["默认"]);
  });
});

describe("开场白 (#373, ADR 0035)", () => {
  const templates = ["模板一「{职位}」", "模板二「{职位}」", "模板三「{职位}」"];

  it("is one of the three templates or the job seeker's own words, at most 200 characters", () => {
    expect(cleanOpener({ template: 2 })).toEqual({ opener: { template: 2 } });
    for (const bad of [{ template: 0 }, { template: 4 }, { template: 1.5 }, { template: "1" }, null, "1", {}])
      expect(cleanOpener(bad)).toBeUndefined();
    expect(cleanOpener({ text: "  您好  " })).toEqual({ opener: { text: "您好" } });
    expect(cleanOpener({ text: "   " })).toEqual({ problem: "empty" });
    expect(cleanOpener({ text: "字".repeat(OPENER_MAX) })).toHaveProperty("opener");
    expect(cleanOpener({ text: "字".repeat(OPENER_MAX + 1) })).toEqual({ problem: "too_long" });
  });

  it("is template 1 until chosen, and keeps as JSON", () => {
    expect(openerText(null, templates)).toBe(templates[0]);
    expect(openerText({ template: 3 }, templates)).toBe(templates[2]);
    expect(openerText({ text: "我自己写的" }, templates)).toBe("我自己写的");
    expect(readOpener(storeOpener({ template: 2 }))).toEqual({ template: 2 });
    expect(readOpener(storeOpener({ text: "你好" }))).toEqual({ text: "你好" });
    expect(storeOpener(null)).toBeNull();
    expect(readOpener('{"template":9}')).toBeNull();
  });

  it("names the job where {职位} or {job} stands, every time, and leaves other text alone", () => {
    expect(fillOpener("您好，我对「{职位}」很感兴趣；「{职位}」", "点心师傅")).toBe(
      "您好，我对「点心师傅」很感兴趣；「点心师傅」",
    );
    expect(fillOpener("Hi, the {job} role", "Dim sum chef")).toBe("Hi, the Dim sum chef role");
    expect(fillOpener("您好", "点心师傅")).toBe("您好");
    // A job's name with $ in it is put as it is (no replacement patterns).
    expect(fillOpener("{职位}", "$& 店员")).toBe("$& 店员");
  });
});

describe("the default texts the user approved (10-24)", () => {
  for (const lang of LANGS) {
    const t = pick(chatMessages, lang).phrases;
    it(`${lang}: five for each identity and three openers, within the limits and with no contact details`, () => {
      expect(t.seekerDefaults).toHaveLength(5);
      expect(t.employerDefaults).toHaveLength(5);
      expect(t.openers).toHaveLength(3);
      for (const list of [t.seekerDefaults, t.employerDefaults])
        expect(cleanPhrases([...list])).toEqual({ phrases: [...list] });
      for (const opener of t.openers) {
        expect(fillOpener(opener, "X")).not.toBe(opener); // each names the job
        expect(cleanOpener({ text: opener })).toHaveProperty("opener");
      }
      for (const text of [...t.seekerDefaults, ...t.employerDefaults, ...t.openers])
        expect(readContact(text)).toEqual({});
    });
  }
});
