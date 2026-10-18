"use client";

// Round 20 (ADR 0023): the language in the browser. The root layout wraps the page in <LangProvider lang> with the
// language it renders in (step 1); client components read it with useLang() and useMessages(). Without a provider
// the language is Chinese, so components can switch to dictionaries before step 1 lands.
import { usePathname } from "next/navigation";
import { createContext, use, type PropsWithChildren } from "react";
import { DEFAULT_LANG, sitePath, type Lang } from "@/i18n/lang";
import { pick, type Dictionary, type Messages } from "@/i18n/messages";

const LangContext = createContext<Lang>(DEFAULT_LANG);

export function LangProvider({ lang, children }: PropsWithChildren<{ lang: Lang }>) {
  return <LangContext value={lang}>{children}</LangContext>;
}

/** The language the page renders in. */
export function useLang(): Lang {
  return use(LangContext);
}

/** A dictionary in the page's language: `const t = useMessages(saveMessages)`. */
export function useMessages<T>(dictionary: Dictionary<T>): Messages<T> {
  return pick(dictionary, useLang());
}

/**
 * usePathname() as the address bar shows it: the server renders a page as /zh/jobs (the proxy's rewrite into
 * app/[lang]) while the browser is on /jobs, so components that look at the path read it through this and both sides
 * agree (ADR 0023 §2).
 */
export function useSitePathname(): string {
  return sitePath(usePathname());
}
