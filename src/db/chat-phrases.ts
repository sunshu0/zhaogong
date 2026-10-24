// 常用语 and 开场白 an account keeps (#372, #373, ADR 0035): accounts.seeker_phrases, employer_phrases and
// chat_opener, migration 0034. Server only; what is written has been checked by the Server Function.
import { eq } from "drizzle-orm";
import { database } from "@/db/ready";
import { accounts } from "@/db/schema";
import { normalizeEmail } from "@/components/seeker/session";
import {
  NO_PHRASES,
  readOpener,
  readPhrases,
  storeOpener,
  storePhrases,
  type ChatPhrases,
  type OpenerChoice,
  type PhraseRole,
} from "@/lib/chat-phrases";

/** What the account keeps; all null (the defaults) when it never changed anything or there is no such account. */
export async function getChatPhrases(email: string): Promise<ChatPhrases> {
  const db = await database();
  const [row] = await db
    .select({ seeker: accounts.seekerPhrases, employer: accounts.employerPhrases, opener: accounts.chatOpener })
    .from(accounts)
    .where(eq(accounts.email, normalizeEmail(email)));
  if (!row) return NO_PHRASES;
  return { seeker: readPhrases(row.seeker), employer: readPhrases(row.employer), opener: readOpener(row.opener) };
}

/** Keeps one identity's 常用语; null goes back to the defaults. */
export async function setChatPhrases(email: string, role: PhraseRole, phrases: string[] | null): Promise<void> {
  const db = await database();
  const value = storePhrases(phrases);
  await db
    .update(accounts)
    .set(role === "seeker" ? { seekerPhrases: value } : { employerPhrases: value })
    .where(eq(accounts.email, normalizeEmail(email)));
}

/** Keeps the job seeker's 开场白; null goes back to template 1. */
export async function setChatOpener(email: string, opener: OpenerChoice | null): Promise<void> {
  const db = await database();
  await db
    .update(accounts)
    .set({ chatOpener: storeOpener(opener) })
    .where(eq(accounts.email, normalizeEmail(email)));
}
