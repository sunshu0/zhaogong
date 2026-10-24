// 常用语 (#372) and 开场白 (#373), ADR 0035: what an account keeps for its chats, in `accounts` (migration 0034).
// Pure, for the browser and the server. The default texts are in the chat dictionary (phrases.seekerDefaults,
// employerDefaults, openers); the server keeps only what a person changed, so an account that never changed them
// sees the defaults in the page's language.

/** At most this many 常用语 per identity, each at most PHRASE_MAX characters. */
export const PHRASES_MAX = 10;
export const PHRASE_MAX = 60;
/** A 开场白 the job seeker writes: at most this many characters. */
export const OPENER_MAX = 200;
/** How many 开场白 templates there are to choose from (phrases.openers in the dictionary). */
export const OPENER_TEMPLATES = 3;

/** Whose 常用语: the job seeker's and the business's are kept apart on one account. */
export type PhraseRole = "seeker" | "employer";

/** The 开场白: one of the templates (1-based), or the job seeker's own words. */
export type OpenerChoice = { template: number } | { text: string };

/** What an account keeps; null where it never changed the default. */
export interface ChatPhrases {
  seeker: string[] | null;
  employer: string[] | null;
  opener: OpenerChoice | null;
}

export const NO_PHRASES: ChatPhrases = { seeker: null, employer: null, opener: null };

/** Why a list or an opener was not saved. `index` is the 常用语 it is about, from 0. */
export type PhrasesProblem =
  | { problem: "too_many" }
  | { problem: "too_long"; index?: number }
  | { problem: "empty" }
  | { problem: "contact"; index?: number; found: string[] };

export const isPhraseRole = (value: unknown): value is PhraseRole => value === "seeker" || value === "employer";

/**
 * A list as a person sent it, made ready to keep: each trimmed, the blank ones left out. A problem when there are
 * more than PHRASES_MAX or one is longer than PHRASE_MAX; undefined when it is not a list of strings at all.
 */
export function cleanPhrases(list: unknown): { phrases: string[] } | PhrasesProblem | undefined {
  if (!Array.isArray(list) || list.length > 100 || !list.every((item) => typeof item === "string")) return undefined;
  const phrases = list.map((item: string) => item.trim().replace(/\s+/g, " ")).filter(Boolean);
  if (phrases.length > PHRASES_MAX) return { problem: "too_many" };
  const long = phrases.findIndex((phrase) => [...phrase].length > PHRASE_MAX);
  if (long >= 0) return { problem: "too_long", index: long };
  return { phrases };
}

/** An opener choice as a person sent it: a template number in range, or their own words trimmed (not blank). */
export function cleanOpener(choice: unknown): { opener: OpenerChoice } | PhrasesProblem | undefined {
  if (!choice || typeof choice !== "object") return undefined;
  if ("template" in choice) {
    const n = choice.template;
    return Number.isInteger(n) && (n as number) >= 1 && (n as number) <= OPENER_TEMPLATES
      ? { opener: { template: n as number } }
      : undefined;
  }
  if ("text" in choice && typeof choice.text === "string") {
    const text = choice.text.trim();
    if (!text) return { problem: "empty" };
    if ([...text].length > OPENER_MAX) return { problem: "too_long" };
    return { opener: { text } };
  }
  return undefined;
}

/** What goes into the column: null for the default. */
export const storePhrases = (phrases: string[] | null): string | null => (phrases ? JSON.stringify(phrases) : null);
export const storeOpener = (opener: OpenerChoice | null): string | null => (opener ? JSON.stringify(opener) : null);

function parse(stored: string | null | undefined): unknown {
  if (!stored) return undefined;
  try {
    return JSON.parse(stored);
  } catch {
    return undefined;
  }
}

/** A kept list, or null (the defaults) when there is none or it cannot be read. */
export function readPhrases(stored: string | null | undefined): string[] | null {
  const cleaned = cleanPhrases(parse(stored));
  return cleaned && "phrases" in cleaned ? cleaned.phrases : null;
}

export function readOpener(stored: string | null | undefined): OpenerChoice | null {
  const cleaned = cleanOpener(parse(stored));
  return cleaned && "opener" in cleaned ? cleaned.opener : null;
}

/** The 常用语 to show: the identity's own, else the defaults in the page's language. */
export const shownPhrases = (kept: ChatPhrases, role: PhraseRole, defaults: readonly string[]): readonly string[] =>
  kept[role] ?? defaults;

/** The 开场白 as written, before {职位} is filled in: the chosen template, or the person's own; template 1 by default. */
export function openerText(opener: OpenerChoice | null, templates: readonly string[]): string {
  if (opener && "text" in opener) return opener.text;
  return templates[(opener?.template ?? 1) - 1] ?? templates[0] ?? "";
}

/** Where a 开场白 names the job: {职位}, or {job} on the English side. */
const JOB_PLACEHOLDER = /\{(?:职位|job)\}/g;

/** The 开场白 for one job: the placeholder replaced by the job's name in the page's language. */
export const fillOpener = (text: string, jobTitle: string): string => text.replace(JOB_PLACEHOLDER, () => jobTitle);
