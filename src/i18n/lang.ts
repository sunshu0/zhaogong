// Round 20 (ADR 0023): the interface's two languages. Plain values with no server or browser code, so pages,
// client components, the proxy and tests share them.

/** The interface languages. Chinese is the default; the browser's language is not looked at (ADR 0023 §1). */
export const LANGS = ["zh", "en"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "zh";

/** The cookie that remembers the choice (ADR 0023 §5). Only the language switch's Server Function sets it. */
export const LANG_COOKIE = "zg_lang";

export function isLang(value: unknown): value is Lang {
  return value === "zh" || value === "en";
}

/** A stored value (the cookie, the account's setting) as a language: anything unknown or missing is Chinese. */
export function langFrom(value: string | null | undefined): Lang {
  return isLang(value) ? value : DEFAULT_LANG;
}

/** The tag for <html lang> and Intl: Chinese as written in mainland China, English as written in New Zealand. */
export function localeTag(lang: Lang): "zh-CN" | "en-NZ" {
  return lang === "en" ? "en-NZ" : "zh-CN";
}

/**
 * The address people use for a path with the internal language segment (ADR 0023 §2): /zh/jobs → /jobs, /en → /.
 * Pages live under app/[lang] and the proxy rewrites to it, so a page's own pathname may carry the segment on the
 * server and not in the browser; reading it through this keeps both sides the same.
 */
export function sitePath(pathname: string): string {
  return pathname.replace(/^\/(zh|en)(?=\/|$)/, "") || "/";
}

/**
 * Where the proxy sends a page request (ADR 0023 §2). An address with a language segment goes back, permanently,
 * to the one without it (one address per page until English gets its own, §9); any other is served from the copy
 * in the cookie's language, Chinese without one. The address in the browser does not change.
 */
export function langRoute(pathname: string, cookie: string | undefined): { redirect: string } | { rewrite: string } {
  const plain = sitePath(pathname);
  if (plain !== pathname) return { redirect: plain };
  return { rewrite: `/${langFrom(cookie)}${pathname === "/" ? "" : pathname}` };
}

/**
 * The lang attribute for text a person wrote (a job's Chinese title, a business's name, shifts): zh-CN when it has
 * Chinese in it, so screen readers read it as Chinese on the English page (ADR 0023 §6); nothing for Latin text.
 */
export function contentLang(text: string | undefined | null): "zh-CN" | undefined {
  return text && /[㐀-鿿豈-﫿]/.test(text) ? "zh-CN" : undefined;
}
