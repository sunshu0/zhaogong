"use server";

// Round 20 (ADR 0023 §5): the language switch in the header and in 我的. It sets the zg_lang cookie, which the proxy
// reads to serve the page in that language, and keeps the choice on the account when signed in. The switch then
// reloads the whole page: Next keeps pages seen before and prefetched data in the old language.
import { cookies } from "next/headers";
import { setAccountLang } from "@/db/account-lang";
import { langCookieOptions } from "@/i18n/cookie";
import { LANG_COOKIE, langFrom, type Lang } from "@/i18n/lang";
import { getCurrentSession } from "@/lib/auth";

export async function setLang(value: string): Promise<Lang> {
  const lang = langFrom(value);
  (await cookies()).set(LANG_COOKIE, lang, langCookieOptions());
  const session = await getCurrentSession();
  if (session) await setAccountLang(session.email, lang);
  return lang;
}
