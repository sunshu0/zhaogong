import { pick } from "@/i18n/messages";
import { describe, expect, it } from "vitest";
import { candidateMatchingMessages } from "@/i18n/messages/candidate-matching";
import { chatMessages } from "@/i18n/messages/chat";
import { complianceMessages } from "@/i18n/messages/compliance";
import { employerApplicantsMessages } from "@/i18n/messages/employer-applicants";
import { employerCommonMessages } from "@/i18n/messages/employer-common";
import { employerJobsMessages } from "@/i18n/messages/employer-jobs";
import { employerPageMessages } from "@/i18n/messages/employer-page";
import { employerPostMessages } from "@/i18n/messages/employer-post";
import { employerTeamMessages } from "@/i18n/messages/employer-team";
import { employerVerifyMessages } from "@/i18n/messages/employer-verify";

// Line B's dictionaries (Round 20 step 0): employer pages, chat, compliance, candidate matching. The checks are
// line C's (line-c.test.ts), so the two lines' dictionaries meet the same bar.
const DICTIONARIES = {
  "employer-jobs": employerJobsMessages,
  "employer-post": employerPostMessages,
  "employer-applicants": employerApplicantsMessages,
  "employer-team": employerTeamMessages,
  "employer-page": employerPageMessages,
  "employer-verify": employerVerifyMessages,
  "employer-common": employerCommonMessages,
  chat: chatMessages,
  compliance: complianceMessages,
  "candidate-matching": candidateMatchingMessages,
};

// Texts allowed to break the rules below, each on purpose: the job form's Chinese-title field shows a Chinese
// example in English too; declining a team invite says nothing; Chinese runs matched words together.
const CHINESE_IN_ENGLISH = ["employer-post:form.titleZhPlaceholder"];
// …and the English for a changed role starts with the name ("Ann's role is now: Admin."), so nothing goes before it.
const EMPTY = [
  "employer-team:teamActions.answer.declined",
  "compliance:words.joiner",
  "employer-team:teamPage.changedBefore",
];

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

describe("line B's dictionaries", () => {
  it.each(Object.entries(DICTIONARIES))("%s: the English side has no Chinese left but the name 找工", (name, d) => {
    const left = texts(d.en).filter(
      ([p, t]) => /[㐀-鿿　-〿＀-￯]/.test(t.replaceAll("找工", "")) && !CHINESE_IN_ENGLISH.includes(`${name}:${p}`),
    );
    expect(left).toEqual([]);
  });

  it.each(Object.entries(DICTIONARIES))("%s: both sides give the same paths, none of them empty", (name, d) => {
    const zh = texts(d.zh);
    const en = texts(d.en);
    expect(en.map(([p]) => p)).toEqual(zh.map(([p]) => p));
    const empty = ([p, t]: [string, string]) => !t.trim() && !EMPTY.includes(`${name}:${p}`);
    expect(zh.filter(empty)).toEqual([]);
    expect(en.filter(empty)).toEqual([]);
  });

  it("words with a figure agree with it in English", () => {
    const en = pick(employerJobsMessages, "en");
    expect([en.numbers.applicants(1), en.numbers.applicants(3)]).toEqual(["1 application", "3 applications"]);
    expect([
      pick(employerPostMessages, "en").bars.holdReason(1, 0),
      pick(employerPostMessages, "en").bars.holdReason(2, 3),
    ]).toEqual(["1 problem to fix", "2 problems to fix, 3 fields to fill in"]);
    expect([
      pick(candidateMatchingMessages, "en").facts.years(1),
      pick(candidateMatchingMessages, "en").facts.years(4),
    ]).toEqual(["1 year", "4 years"]);
  });

  it("holdReason says the same as use-draft-form's in Chinese", () => {
    const { holdReason } = employerPostMessages.zh.bars;
    expect([holdReason(2, 3), holdReason(0, 1), holdReason(1, 0)]).toEqual([
      "2 个问题要处理，3 项没填",
      "1 项没填",
      "1 个问题要处理",
    ]);
  });
});
