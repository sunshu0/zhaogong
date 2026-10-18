// The interface language an account chose (Round 20, ADR 0023 §5): accounts.lang, migration 0025. Server only.
import { eq } from "drizzle-orm";
import { database } from "@/db/ready";
import { accounts } from "@/db/schema";
import { isLang, type Lang } from "@/i18n/lang";
import { normalizeEmail } from "@/components/seeker/session";

/** The language the account chose, or null when it never chose one (or there is no such account). */
export async function getAccountLang(email: string): Promise<Lang | null> {
  const db = await database();
  const [row] = await db
    .select({ lang: accounts.lang })
    .from(accounts)
    .where(eq(accounts.email, normalizeEmail(email)));
  return row && isLang(row.lang) ? row.lang : null;
}

export async function setAccountLang(email: string, lang: Lang): Promise<void> {
  const db = await database();
  await db
    .update(accounts)
    .set({ lang })
    .where(eq(accounts.email, normalizeEmail(email)));
}

/**
 * At sign-in: the account's language wins when it has one, so a new device comes up in it; an account that never
 * chose takes the language this browser is using. Returns the language from now on.
 */
export async function langOnSignIn(email: string, browserLang: Lang): Promise<Lang> {
  const chosen = await getAccountLang(email);
  if (chosen) return chosen;
  await setAccountLang(email, browserLang);
  return browserLang;
}
