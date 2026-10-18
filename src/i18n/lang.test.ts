import { describe, expect, it } from "vitest";
import { DEFAULT_LANG, LANGS, isLang, langFrom, localeTag } from "@/i18n/lang";

describe("languages", () => {
  it("are Chinese and English, Chinese first and by default", () => {
    expect(LANGS).toEqual(["zh", "en"]);
    expect(DEFAULT_LANG).toBe("zh");
  });

  it("reads a stored value, and anything unknown or missing is Chinese", () => {
    expect(langFrom("en")).toBe("en");
    expect(langFrom("zh")).toBe("zh");
    for (const value of [undefined, null, "", "EN", "en-NZ", "fr", " en"]) expect(langFrom(value)).toBe("zh");
    expect(isLang("en")).toBe(true);
    expect(isLang(1)).toBe(false);
  });

  it("gives <html lang> and Intl the Chinese of mainland China and the English of New Zealand", () => {
    expect(localeTag("zh")).toBe("zh-CN");
    expect(localeTag("en")).toBe("en-NZ");
  });
});
