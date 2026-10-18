import { describe, expect, it } from "vitest";
import { DEFAULT_LANG, LANGS, contentLang, isLang, langFrom, langRoute, localeTag, sitePath } from "@/i18n/lang";

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

  it("drops the internal language segment from a path, and only a whole segment", () => {
    expect(sitePath("/zh/jobs/j1")).toBe("/jobs/j1");
    expect(sitePath("/en")).toBe("/");
    expect(sitePath("/zh")).toBe("/");
    expect(sitePath("/jobs")).toBe("/jobs");
    expect(sitePath("/")).toBe("/");
    expect(sitePath("/zhaopin")).toBe("/zhaopin");
    expect(sitePath("/english/x")).toBe("/english/x");
  });

  it("routes a page request by the cookie, and sends an address with a language back to the plain one", () => {
    expect(langRoute("/jobs", undefined)).toEqual({ rewrite: "/zh/jobs" });
    expect(langRoute("/jobs", "en")).toEqual({ rewrite: "/en/jobs" });
    expect(langRoute("/jobs", "fr")).toEqual({ rewrite: "/zh/jobs" });
    expect(langRoute("/", "en")).toEqual({ rewrite: "/en" });
    expect(langRoute("/", undefined)).toEqual({ rewrite: "/zh" });
    expect(langRoute("/en/jobs", "en")).toEqual({ redirect: "/jobs" });
    expect(langRoute("/zh", undefined)).toEqual({ redirect: "/" });
  });

  it("serves a Server Action Next forwards to another page's route name in the cookie's language", () => {
    expect(langRoute("/[lang]/notifications", "en")).toEqual({ rewrite: "/en/notifications" });
    expect(langRoute("/%5Blang%5D/account/data", undefined)).toEqual({ rewrite: "/zh/account/data" });
    expect(langRoute("/[lang]", "en")).toEqual({ rewrite: "/en" });
  });

  it("marks a person's text Chinese when it has Chinese in it, and leaves Latin text alone", () => {
    expect(contentLang("前厅服务员")).toBe("zh-CN");
    expect(contentLang("川味小馆 Sichuan")).toBe("zh-CN");
    expect(contentLang("Tūī Software")).toBeUndefined();
    expect(contentLang("")).toBeUndefined();
    expect(contentLang(undefined)).toBeUndefined();
  });
});
