// Round 20 (ADR 0023): the language on the server. Server Components and server-side helpers use messages() and
// serverLang(); Server Functions and Route Handlers, which have no root parameters, use requestLang().
// Server only: it reads next/headers. Client components use ./client.
import { cookies } from "next/headers";
import { DEFAULT_LANG, LANG_COOKIE, langFrom, type Lang } from "@/i18n/lang";
import { pick, type Dictionary, type Messages } from "@/i18n/messages";

/**
 * The language a Server Component renders in. Round 20's step 1 moves the pages under app/[lang] and this then
 * reads the root parameter (`lang()` from next/root-params), which keeps every page prerendered, one copy per
 * language. Until then every page is Chinese. Never read the cookie here: outside a Suspense boundary that stops
 * the page from being prerendered (Cache Components).
 */
export async function serverLang(): Promise<Lang> {
  return DEFAULT_LANG;
}

/** A dictionary in the language this Server Component renders in: `const t = await messages(saveMessages)`. */
export async function messages<T>(dictionary: Dictionary<T>): Promise<Messages<T>> {
  return pick(dictionary, await serverLang());
}

/** The visitor's language in a Server Function or a Route Handler (errors it returns, the sign-in email). */
export async function requestLang(): Promise<Lang> {
  return langFrom((await cookies()).get(LANG_COOKIE)?.value);
}
