// #240: where the dictionaries' English sides are kept. They live in src/i18n/messages/en/ and only this module
// imports them, so the browser's JavaScript carries them only on English pages:
// - on the server (Server Components, the HTML of client components, Server Functions, tests) they are loaded with
//   this module, before anything renders: `typeof window` is "undefined" there, and the browser's build drops this
//   branch altogether;
// - in the browser, LangProvider (./client) waits for loadEnglish() on an English page before its children render.
let table: Record<string, unknown> | null = null;
if (typeof window === "undefined") table = (await import("@/i18n/messages/en")).english;

let loading: Promise<void> | null = null;

/** Whether the English sides are here (always on the server). */
export function englishLoaded(): boolean {
  return table !== null;
}

/** Loads the English sides in the browser, once; the same promise every time, for React's use(). */
export function loadEnglish(): Promise<void> {
  loading ??= import("@/i18n/messages/en").then((m) => {
    table = m.english;
  });
  return loading;
}

/** The English side of the dictionary with this key. */
export function englishFor(key: string): unknown {
  if (!table) throw new Error("The English dictionaries are not loaded yet (src/i18n/english.ts).");
  const en = table[key];
  if (!en) throw new Error(`No English for the dictionary "${key}": run scripts/i18n-split-en.mjs on it.`);
  return en;
}
