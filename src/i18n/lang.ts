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
