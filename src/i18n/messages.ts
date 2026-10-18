// Round 20 (ADR 0023): the dictionaries' types. No server code, so dictionary files and client components import
// it too. Server Components get their language's side with messages() (./server), client components with
// useMessages() (./client).
//
// A dictionary lives in src/i18n/messages/<module>.ts. Write the Chinese side first and type the whole with
// Dictionary<typeof itsChinese>; the English side is then checked against the Chinese one:
//
//   import type { Dictionary } from "@/i18n/messages";
//
//   const saveZh = {
//     save: "收藏",
//     savedCount: (n: number) => `已收藏 ${n} 个`,
//   };
//   export const saveMessages: Dictionary<typeof saveZh> = {
//     zh: saveZh,
//     en: {
//       save: "Save",
//       savedCount: (n) => (n === 1 ? "1 saved" : `${n} saved`),
//     },
//   };
//
// Wording with a number or a name in it is a function, never a template string to fill in later. A plain object
// literal (not a function call) keeps unused dictionaries out of the browser's JavaScript.

import type { Lang } from "@/i18n/lang";

/**
 * The English side of a dictionary, shaped by the Chinese side: the same keys; a string for each string, a list
 * of strings for each list, and for each function a function with the same parameters that returns a string.
 * Groups nest the same way. A missing key, an extra key or a different parameter fails `tsc`.
 */
export type Messages<T> = {
  [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends readonly string[]
      ? readonly string[]
      : T[K] extends (...args: infer A) => string
        ? (...args: A) => string
        : Messages<T[K]>;
};

/** A dictionary: the Chinese text as written, and the English one checked against it. */
export type Dictionary<T> = { readonly zh: T; readonly en: Messages<T> };

/** One language's side of a dictionary. */
export function pick<T>(dictionary: Dictionary<T>, lang: Lang): Messages<T> {
  return lang === "en" ? dictionary.en : (dictionary.zh as unknown as Messages<T>);
}
