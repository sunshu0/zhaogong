import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

// Round 20 step 2 (#237, ADR 0023): the English interface's checks, shared by the three lines' specs. With the
// zg_lang=en cookie a page must say <html lang="en-NZ">, pass axe, fit the screen, and show no Chinese of its own.
//
//   test("…", async ({ page, baseURL }) => {
//   await useEnglish(page, baseURL);
//   await page.goto("/jobs");
//   await expectEnglishPage(page, "/jobs");
//   await expectEnglishPage(page, "/jobs with 筛选 open", { allow: ["点心师傅"] });
//
// Chinese the person wrote (a job's Chinese title, a business's name, a chat) is not translated: the page marks it
// lang="zh-CN" (ADR 0023 §6, contentLang() in src/i18n/lang.ts), and Chinese inside such an element passes, as does
// the same text quoted elsewhere on the page (an aria-label "Save: 前厅服务员"). Anything else Chinese is a missed
// translation, unless it is in ALLOWED_CHINESE or in the call's `allow`.

export const LANG_COOKIE = "zg_lang";

/**
 * Chinese an English page shows on purpose: the product name (not translated until #18), the language switch's
 * 中文, and the 招 stamp of the home page's shop-window notices.
 */
export const ALLOWED_CHINESE: readonly string[] = ["找工", "中文", "招"];

/**
 * The English interface for this page's browser from the next navigation on: the cookie the switch sets. Pass the
 * test's `baseURL` fixture.
 */
export async function useEnglish(page: Page, baseURL: string | undefined): Promise<void> {
  if (!baseURL) throw new Error("useEnglish needs the test's baseURL");
  await page.context().addCookies([{ name: LANG_COOKIE, value: "en", url: baseURL }]);
}

export interface EnglishPageOptions {
  /** More Chinese allowed on this page, e.g. test data the spec typed that the page shows unmarked on purpose. */
  allow?: readonly (string | RegExp)[];
  /** axe rules to leave out on this page, with the reason in a comment where it is called. */
  disableRules?: readonly string[];
}

export interface ChineseLeft {
  /** The text or attribute value, shortened to 80 characters. */
  text: string;
  /** Where: the element's tag, id or first class, up to three levels, and the attribute when it is one. */
  where: string;
}

/**
 * Visible Chinese on the page that is not inside a lang="zh…" element: text, and the aria-label, title,
 * placeholder and alt attributes; the document's title too. `allow` strings and patterns are taken out first.
 */
export async function chineseLeft(page: Page, allow: readonly (string | RegExp)[] = []): Promise<ChineseLeft[]> {
  const patterns = [...ALLOWED_CHINESE, ...allow].map((a) =>
    typeof a === "string"
      ? { source: a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags: "g" }
      : { source: a.source, flags: a.flags.includes("g") ? a.flags : `${a.flags}g` },
  );
  return page.evaluate((patterns) => {
    const CJK = /[㐀-鿿豈-﫿]/;
    const allowed = patterns.map((p) => new RegExp(p.source, p.flags));
    // A person's text the page shows marked lang="zh…" may be quoted elsewhere, e.g. aria-label "Save: 前厅服务员":
    // the same text there is theirs too. Longest first, so a longer text goes before a part of it.
    const quoted = [...document.querySelectorAll('[lang^="zh"]:not(html)')]
      .map((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim())
      .filter((text) => CJK.test(text))
      .sort((a, b) => b.length - a.length);
    // The quoted texts go first: an allowed word inside a person's text (the 招 of a title 招聘记录服务员) taken out
    // first would leave "Save: 聘记录服务员", which no longer matches the marked title (#241).
    const strip = (s: string) =>
      allowed.reduce(
        (rest, re) => rest.replace(re, ""),
        quoted.reduce((rest, text) => rest.split(text).join(""), s),
      );
    const markedChinese = (el: Element | null) => !!el?.closest('[lang^="zh"]:not(html)');
    const shown = (el: Element) =>
      !el.closest("script, style, noscript, template, [hidden]") &&
      (el as HTMLElement).checkVisibility?.({ checkOpacity: false, checkVisibilityCSS: true }) !== false;
    const where = (el: Element, attribute?: string) => {
      const parts: string[] = [];
      for (let e: Element | null = el; e && parts.length < 3 && e !== document.body; e = e.parentElement) {
        parts.unshift(
          e.id
            ? `${e.tagName.toLowerCase()}#${e.id}`
            : e.classList[0]
              ? `${e.tagName.toLowerCase()}.${e.classList[0]}`
              : e.tagName.toLowerCase(),
        );
      }
      return parts.join(" > ") + (attribute ? ` [${attribute}]` : "");
    };
    const found: { text: string; where: string }[] = [];
    const add = (text: string, at: string) => {
      const trimmed = text.replace(/\s+/g, " ").trim();
      if (CJK.test(strip(trimmed))) found.push({ text: trimmed.slice(0, 80), where: at });
    };

    if (CJK.test(strip(document.title))) found.push({ text: document.title.slice(0, 80), where: "title" });
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement;
      if (!el || !CJK.test(node.textContent ?? "") || markedChinese(el) || !shown(el)) continue;
      add(node.textContent ?? "", where(el));
    }
    for (const attribute of ["aria-label", "title", "placeholder", "alt"]) {
      for (const el of document.body.querySelectorAll(`[${attribute}]`)) {
        const value = el.getAttribute(attribute) ?? "";
        if (!CJK.test(value) || markedChinese(el) || !shown(el)) continue;
        add(value, where(el, attribute));
      }
    }
    return found;
  }, patterns);
}

/** How far the page is wider than the screen, in CSS pixels (0 when it fits). */
export async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
}

/**
 * The English page's checks, soft so one call reports all three: <html lang="en-NZ">, axe (WCAG 2.1 A/AA like the
 * other specs), no horizontal overflow, and no Chinese left (chineseLeft). `state` names the page in the report.
 */
export async function expectEnglishPage(page: Page, state: string, options: EnglishPageOptions = {}): Promise<void> {
  await expect(page.locator("html"), `${state}: <html lang>`).toHaveAttribute("lang", "en-NZ");

  let axe = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);
  if (options.disableRules?.length) axe = axe.disableRules([...options.disableRules]);
  const { violations } = await axe.analyze();
  const found = violations.map(
    (v) => `${v.id} (${v.impact}): ${v.help}\n${v.nodes.map((n) => `    ${n.target.join(" ")}`).join("\n")}`,
  );
  expect.soft(found, `${state}: axe\n${found.join("\n")}`).toEqual([]);

  expect.soft(await horizontalOverflow(page), `${state}: wider than the screen`).toBeLessThanOrEqual(1);

  const left = await chineseLeft(page, options.allow);
  expect.soft(left, `${state}: Chinese left\n${left.map((l) => `    ${l.where}: ${l.text}`).join("\n")}`).toEqual([]);
}
