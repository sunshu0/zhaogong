import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LangProvider, useLang, useMessages } from "@/i18n/client";
import type { Lang } from "@/i18n/lang";
import type { Dictionary } from "@/i18n/messages";

const saveZh = { save: "收藏", savedCount: (n: number) => `已收藏 ${n} 个` };
const saveMessages: Dictionary<typeof saveZh> = {
  zh: saveZh,
  en: { save: "Save", savedCount: (n) => `${n} saved` },
};

function SaveButton() {
  const t = useMessages(saveMessages);
  return createElement("button", { lang: useLang() }, `${t.save} · ${t.savedCount(2)}`);
}

const render = (lang?: Lang) =>
  renderToStaticMarkup(
    lang ? createElement(LangProvider, { lang }, createElement(SaveButton)) : createElement(SaveButton),
  );

describe("the language in client components", () => {
  it("is the provider's", () => {
    expect(render("en")).toBe('<button lang="en">Save · 2 saved</button>');
    expect(render("zh")).toBe('<button lang="zh">收藏 · 已收藏 2 个</button>');
  });

  it("is Chinese without a provider, so components can use dictionaries before the root layout has one", () => {
    expect(render()).toBe('<button lang="zh">收藏 · 已收藏 2 个</button>');
  });
});
