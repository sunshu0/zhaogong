import { describe, expect, it } from "vitest";
import { TAG_STYLES, tagKindFor } from "./tag-kind";

describe("tagKindFor", () => {
  it("gives each job tag its fixed colour", () => {
    expect(tagKindFor("急招")).toBe("urgent");
    expect(tagKindFor("包餐")).toBe("perk");
    expect(tagKindFor("包住")).toBe("perk");
    expect(tagKindFor("接受学签")).toBe("visa");
    expect(tagKindFor("持 AEWV 工签者")).toBe("visa");
  });

  it("falls back to grey for status and anything else", () => {
    expect(tagKindFor("审核中")).toBe("neutral");
    expect(tagKindFor("兼职")).toBe("neutral");
  });

  it("has a style for every kind", () => {
    expect(Object.keys(TAG_STYLES).sort()).toEqual(["neutral", "perk", "urgent", "visa"]);
  });
});
