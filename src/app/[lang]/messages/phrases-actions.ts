"use server";

// 常用语 (#372) and 开场白 (#373) on the server, ADR 0035. Who it is comes from this browser's session cookie; the
// server checks again what the browser checked (count, length) and refuses contact details: phone, WeChat and email
// are given in a chat only through the exchange there (ADR 0002), so a phrase sent with one press must not carry them.
import { getCurrentSession } from "@/lib/auth";
import { readContact } from "@/lib/ai-post/parse";
import { getChatPhrases, setChatOpener, setChatPhrases } from "@/db/chat-phrases";
import {
  cleanOpener,
  cleanPhrases,
  isPhraseRole,
  type ChatPhrases,
  type OpenerChoice,
  type PhrasesProblem,
} from "@/lib/chat-phrases";

/** The account's 常用语 and 开场白, and whose they are (a browser that switched account meanwhile drops it). */
export type PhrasesAnswer = { email: string; phrases: ChatPhrases };

/** A save: what the account keeps now, or why nothing was saved. */
export type PhrasesSave = ({ ok: true } & PhrasesAnswer) | { ok: false; why: PhrasesProblem };

/** Null when nobody is signed in. */
export async function myChatPhrases(): Promise<PhrasesAnswer | null> {
  const session = await getCurrentSession();
  if (!session) return null;
  return { email: session.email, phrases: await getChatPhrases(session.email) };
}

/** Contact details a text carries, as the posting parser reads them (the 企业主页 check of #195 uses the same). */
const contactIn = (text: string) => Object.values(readContact(text));

/**
 * Saves one identity's 常用语 (`phrases`: a list, or null for the defaults) and the 开场白 (`opener`; null for
 * template 1); either left out stays as it is. Everything is checked before anything is written. Null when nobody is signed in or what
 * came is not a save.
 */
export async function saveMyChatPhrases(save: unknown): Promise<PhrasesSave | null> {
  const session = await getCurrentSession();
  if (!session || !save || typeof save !== "object" || !("role" in save) || !isPhraseRole(save.role)) return null;
  const role = save.role;

  let phrases: string[] | null | undefined;
  if ("phrases" in save && save.phrases === null) phrases = null;
  else if ("phrases" in save && save.phrases !== undefined) {
    const cleaned = cleanPhrases(save.phrases);
    if (!cleaned) return null;
    if (!("phrases" in cleaned)) return { ok: false, why: cleaned };
    for (const [index, phrase] of cleaned.phrases.entries()) {
      const found = contactIn(phrase);
      if (found.length) return { ok: false, why: { problem: "contact", index, found } };
    }
    phrases = cleaned.phrases;
  }

  let opener: OpenerChoice | null | undefined;
  if ("opener" in save && save.opener !== undefined) {
    if (save.opener === null) opener = null;
    else {
      const cleaned = cleanOpener(save.opener);
      if (!cleaned) return null;
      if (!("opener" in cleaned)) return { ok: false, why: cleaned };
      const found = "text" in cleaned.opener ? contactIn(cleaned.opener.text) : [];
      if (found.length) return { ok: false, why: { problem: "contact", found } };
      opener = cleaned.opener;
    }
  }

  if (phrases !== undefined) await setChatPhrases(session.email, role, phrases);
  if (opener !== undefined) await setChatOpener(session.email, opener);
  return { ok: true, email: session.email, phrases: await getChatPhrases(session.email) };
}
