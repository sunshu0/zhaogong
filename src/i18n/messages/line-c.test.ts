import { pick } from "@/i18n/messages";
import { describe, expect, it } from "vitest";
import { accountMessages } from "@/i18n/messages/account";
import { adminMessages } from "@/i18n/messages/admin";
import { adminExternalMessages } from "@/i18n/messages/admin-external";
import { adminStatsMessages } from "@/i18n/messages/admin-stats";
import { adminVerificationMessages } from "@/i18n/messages/admin-verification";
import { externalMessages } from "@/i18n/messages/external";
import { loginMessages } from "@/i18n/messages/login";
import { notificationsMessages } from "@/i18n/messages/notifications";

// Line C's dictionaries (Round 20 step 0): sign-in, account, notifications, moderation, external jobs.
const DICTIONARIES = {
  login: loginMessages,
  account: accountMessages,
  notifications: notificationsMessages,
  admin: adminMessages,
  "admin-verification": adminVerificationMessages,
  "admin-stats": adminStatsMessages,
  "admin-external": adminExternalMessages,
  external: externalMessages,
};

// Sample arguments for the wording functions: numbers, words and lists.
const SAMPLE_ARGS = [2, "x", ["a", "b"], true];

/**
 * Every text a side can produce, by path. Functions are called with every argument set to one sample at a time; a
 * sample of the wrong kind may throw (a list where a number goes), so those are left out, but one must work.
 */
function texts(side: unknown, path = ""): [string, string][] {
  if (typeof side === "string") return [[path, side]];
  if (Array.isArray(side)) return side.flatMap((s, i) => texts(s, `${path}[${i}]`));
  if (typeof side === "function") {
    const fn = side as (...args: unknown[]) => unknown;
    const out = SAMPLE_ARGS.flatMap((arg): [string, string][] => {
      try {
        return [[`${path}(${JSON.stringify(arg)})`, String(fn(...Array.from({ length: fn.length }, () => arg)))]];
      } catch {
        return [];
      }
    });
    return out.length ? out : [[`${path}() threw for every sample`, ""]];
  }
  return Object.entries(side as Record<string, unknown>).flatMap(([k, v]) => texts(v, path ? `${path}.${k}` : k));
}

describe("line C's dictionaries", () => {
  it.each(Object.entries(DICTIONARIES))("%s: the English side has no Chinese left but the name 找工", (_, d) => {
    const left = texts(d.en).filter(([, t]) => /[㐀-鿿　-〿＀-￯]/.test(t.replaceAll("找工", "")));
    expect(left).toEqual([]);
  });

  it.each(Object.entries(DICTIONARIES))("%s: both sides give the same paths, none of them empty", (_, d) => {
    const zh = texts(d.zh);
    const en = texts(d.en);
    const entries = (list: [string, string][]) => [...new Set(list.map(([p]) => p.replace(/\(.*$/, "()")))];
    expect(entries(en)).toEqual(entries(zh));
    expect(zh.filter(([, t]) => !t.trim())).toEqual([]);
    // Only the bit after an inline email may be empty in English (the sentence ends before it).
    expect(en.filter(([p, t]) => !t.trim() && p !== "data.confirmAfter")).toEqual([]);
  });

  it("words with a figure agree with it in English", () => {
    const en = pick(adminStatsMessages, "en");
    expect([en.wait.minutes(1), en.wait.minutes(5), en.wait.daysHours(1, 3)]).toEqual([
      "1 minute",
      "5 minutes",
      "1 day 3 hours",
    ]);
    expect([pick(loginMessages, "en").errors.wrongCode(1), pick(loginMessages, "en").errors.wrongCode(4)]).toEqual([
      "That code isn't right. 1 try left.",
      "That code isn't right. 4 tries left.",
    ]);
    expect(pick(adminMessages, "en").log.ban("川味小馆", 1)).toBe("Banned the employer “川味小馆” and took down 1 job");
  });
});
