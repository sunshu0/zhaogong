import { beforeEach, describe, expect, it, vi } from "vitest";
import { LANG_COOKIE } from "@/i18n/lang";
import type { Dictionary } from "@/i18n/messages";

// A Server Function reads the request's cookies; one map stands in for one browser.
const cookies = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookies.has(name) ? { name, value: cookies.get(name) } : undefined),
  }),
}));
// A Server Component's root parameter: the copy of the page the proxy picked (app/[lang]).
let rootLang: string | undefined = "zh";
vi.mock("next/root-params", () => ({ lang: async () => rootLang }));
const { messages, requestLang, serverLang } = await import("@/i18n/server");

const saveZh = { save: "收藏" };
const saveMessages: Dictionary<typeof saveZh> = { zh: saveZh, en: { save: "Save" } };

beforeEach(() => {
  cookies.clear();
  rootLang = "zh";
});

describe("the language on the server", () => {
  it("in a Server Component is the page's root parameter, never the cookie", async () => {
    cookies.set(LANG_COOKIE, "en");
    expect(await serverLang()).toBe("zh");
    expect((await messages(saveMessages)).save).toBe("收藏");
    cookies.clear();
    rootLang = "en";
    expect(await serverLang()).toBe("en");
    expect((await messages(saveMessages)).save).toBe("Save");
    rootLang = undefined; // outside app/[lang] (there is no such page today): Chinese
    expect(await serverLang()).toBe("zh");
  });

  it("in a Server Function is the zg_lang cookie's, Chinese without one or with an unknown value", async () => {
    expect(await requestLang()).toBe("zh");
    cookies.set(LANG_COOKIE, "en");
    expect(await requestLang()).toBe("en");
    cookies.set(LANG_COOKIE, "de");
    expect(await requestLang()).toBe("zh");
  });
});
