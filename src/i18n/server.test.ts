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
const { messages, requestLang, serverLang } = await import("@/i18n/server");

const saveZh = { save: "收藏" };
const saveMessages: Dictionary<typeof saveZh> = { zh: saveZh, en: { save: "Save" } };

beforeEach(() => cookies.clear());

describe("the language on the server", () => {
  it("is Chinese for every page until the pages move under app/[lang] (Round 20 step 1)", async () => {
    cookies.set(LANG_COOKIE, "en");
    expect(await serverLang()).toBe("zh");
    expect((await messages(saveMessages)).save).toBe("收藏");
  });

  it("in a Server Function is the zg_lang cookie's, Chinese without one or with an unknown value", async () => {
    expect(await requestLang()).toBe("zh");
    cookies.set(LANG_COOKIE, "en");
    expect(await requestLang()).toBe("en");
    cookies.set(LANG_COOKIE, "de");
    expect(await requestLang()).toBe("zh");
  });
});
