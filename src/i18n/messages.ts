// Round 20 (ADR 0023): the dictionaries' types. No server code, so dictionary files and client components import
// it too. Server Components get their language's side with messages() (./server), client components with
// useMessages() (./client).
//
// A dictionary lives in two files (#240). src/i18n/messages/<module>.ts has the Chinese side and a key:
//
//   import type { Dictionary } from "@/i18n/messages";
//
//   const saveZh = {
//     save: "收藏",
//     savedCount: (n: number) => `已收藏 ${n} 个`,
//   };
//   export const saveMessages: Dictionary<typeof saveZh> = { key: "save", zh: saveZh };
//
// src/i18n/messages/en/<module>.ts has the English side, checked against the Chinese one, and en/index.ts lists it
// under the same key (scripts/i18n-split-en.mjs moves an inline `en` there):
//
//   export const saveEn: Messages<(typeof saveMessages)["zh"]> = {
//     save: "Save",
//     savedCount: (n) => (n === 1 ? "1 saved" : `${n} saved`),
//   };
//
// The browser loads the English sides only on English pages (src/i18n/english.ts). A dictionary not moved yet may
// still carry `en` inline; pick() uses it.
//
// Wording with a number or a name in it is a function, never a template string to fill in later. A plain object
// literal (not a function call) keeps unused dictionaries out of the browser's JavaScript.

import { englishFor } from "@/i18n/english";
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

/**
 * A dictionary: the Chinese text as written, and the key its English side is listed under in messages/en/index.ts
 * (or, until it is moved there, the English side inline).
 */
export type Dictionary<T> =
  | { readonly key: string; readonly zh: T; readonly en?: undefined }
  | { readonly key?: undefined; readonly zh: T; readonly en: Messages<T> };

/** One language's side of a dictionary. */
export function pick<T>(dictionary: Dictionary<T>, lang: Lang): Messages<T> {
  if (lang !== "en") return dictionary.zh as unknown as Messages<T>;
  return dictionary.key === undefined ? dictionary.en : (englishFor(dictionary.key) as Messages<T>);
}
