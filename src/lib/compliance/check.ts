// Compliance check run on every draft before it can be published. Pure functions, no I/O.
import { COUNTRIES } from "@/config/countries";
import { formatDate, formatMoney } from "@/i18n/format";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { complianceMessages } from "@/i18n/messages/compliance";
import type { CountryCode } from "@/lib/types";
import { WORD_RULES, type WordRule } from "./rules";
import type { ChatFinding, Finding, FindingLevel, JobDraft, PostingEmployer } from "./types";

const TEXT_FIELDS = ["titleZh", "titleEn", "shiftsZh", "address", "descriptionZh", "descriptionEn"] as const;

const LEVEL_ORDER: Record<FindingLevel, number> = { block: 0, rewrite: 1, review: 2 };

/** Spaces and symbols people put between characters to get past a filter, e.g. 包 签, 押*金. */
const FILLER = /[\s\u200b-\u200d\ufeff*\u00b7\u2022._\-~|\\/]/;
/** Joins two words of the same list: 押金和介绍费. Commas are left out on purpose: 不收介绍费，押金500. */
const JOINER_END = /[和、或及与跟]$/;
const JOINER_START = /^[和、或及与跟]/;

const NEGATED_BEFORE_ZH = /(不|无|免|零|没有|拒绝|绝不)(收取|收|取|需要|需|要|用|交|付|设|任何|额外|另外|另)*$/;
/** After a fee word: 全免, 不收 … clear it outright; a bare 无 or 免 only when its phrase ends there (押金：无). */
const NEGATED_AFTER_ZH = /^[:：]?(?:(全免|全无|不收|为零|为0|0元)|无|免)/;
const PHRASE_END = /[，,。;；!！?？、)）]/;
const NEGATED_BEFORE_EN =
  /\b(no|not|never|without|zero|free of|don't|do not|doesn't|does not|won't|will not)(\s+(charge|charges|charging|ask|asking|require|requires|required|need|needs|take|takes|pay|for|any|a|an|or|and))*\s*$/;
const NEGATED_AFTER_EN = /^\s+((is|are)\s+)?(not\s+(required|needed|charged)|waived|free)\b/;

const isLatin = (word: string) => /^[\x20-\x7e]+$/.test(word);
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Text with filler removed, plus the positions where filler was (a space ends a phrase too). */
function compactText(text: string): { compact: string; gaps: Set<number> } {
  let compact = "";
  const gaps = new Set<number>();
  for (const char of text) {
    if (FILLER.test(char)) gaps.add(compact.length);
    else compact += char;
  }
  return { compact, gaps };
}

function negatedAfterZh(text: string, at: number, gaps: Set<number>): boolean {
  const m = NEGATED_AFTER_ZH.exec(text.slice(at));
  if (!m) return false;
  if (m[1]) return true;
  const next = at + m[0].length;
  return next === text.length || gaps.has(next) || PHRASE_END.test(text[next]);
}

function negatedZh(text: string, gaps: Set<number>, start: number, end: number, rule: WordRule): boolean {
  const cjkWords = rule.words.filter((w) => !isLatin(w));
  // Step back over other words of the same list, so 不收押金和介绍费 negates both.
  let before = text.slice(0, start);
  for (;;) {
    const trimmed = before.replace(JOINER_END, "");
    const word = cjkWords.find((w) => trimmed.endsWith(w));
    if (!word) break;
    before = trimmed.slice(0, -word.length);
  }
  if (NEGATED_BEFORE_ZH.test(before.slice(-8))) return true;
  if (!rule.negatableAfter) return false;
  let after = end;
  for (;;) {
    const joiner = JOINER_START.test(text.slice(after)) ? 1 : 0;
    const word = cjkWords.find((w) => text.startsWith(w, after + joiner));
    if (!word) break;
    after += joiner + word.length;
  }
  return negatedAfterZh(text, after, gaps);
}

function negatedEn(text: string, start: number, end: number): boolean {
  return (
    NEGATED_BEFORE_EN.test(text.slice(Math.max(0, start - 40), start)) ||
    NEGATED_AFTER_EN.test(text.slice(end, end + 30))
  );
}

/** Words of one rule found in a piece of text, in the order they appear, each once. */
function findWords(text: string, rule: WordRule): string[] {
  const normal = text
    .normalize("NFKC")
    .replace(/[\u2018\u2019]/g, "'")
    .toLowerCase();
  const { compact, gaps } = compactText(normal);
  const spaced = normal.replace(/\s+/g, " ");
  const hits: { start: number; end: number; word: string; latin: boolean }[] = [];
  // Longer words first, so 仅限华人 is reported once and not again as 限华人.
  for (const word of [...rule.words].sort((a, b) => b.length - a.length)) {
    const latin = isLatin(word);
    const needle = word.toLowerCase();
    const haystack = latin ? spaced : compact;
    const pattern = new RegExp(latin ? `\\b${escapeRegExp(needle)}\\b` : escapeRegExp(needle), "g");
    for (const m of haystack.matchAll(pattern)) {
      const start = m.index ?? 0;
      const end = start + needle.length;
      if (hits.some((h) => h.latin === latin && h.start <= start && end <= h.end)) continue;
      if (latin ? negatedEn(haystack, start, end) : negatedZh(haystack, gaps, start, end, rule)) continue;
      hits.push({ start, end, word, latin });
    }
  }
  return [...new Set(hits.sort((a, b) => a.start - b.start).map((h) => h.word))];
}

/**
 * The day a minimum wage starts, as each language writes it: Chinese keeps the config's own 2026-04-01, English
 * reads 1 April 2026. The config's date is a New Zealand day, so it is formatted in New Zealand time (format.ts).
 */
export function wageFromDate(effectiveFrom: string, lang: Lang): string {
  if (lang !== "en") return effectiveFrom;
  return formatDate(`${effectiveFrom}T00:00:00+12:00`, lang, { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Everything that stops or holds this draft, most serious first. An empty list means it can go live.
 * With the employer, it also checks what only some employers may offer (AEWV holders).
 * The messages are written in `lang` (Round 20); `message_zh` keeps its name across the codebase.
 */
export function checkJob(
  draft: JobDraft,
  country: CountryCode,
  employer?: PostingEmployer,
  lang: Lang = DEFAULT_LANG,
): Finding[] {
  const config = COUNTRIES[country];
  const t = pick(complianceMessages, lang);
  const findings: Finding[] = [];

  const wage = config.minimumWage;
  if (draft.pay && wage.hourly > 0 && draft.pay.min < wage.hourly) {
    findings.push({
      level: "block",
      field: "pay",
      rule: "min_wage",
      message_zh: t.minWage.message(
        formatMoney(draft.pay.min, lang, config.currency),
        lang === "en" ? config.nameEn : config.nameZh,
        formatMoney(wage.hourly, lang, config.currency),
        wageFromDate(wage.effectiveFrom, lang),
      ),
    });
  }

  if (employer && employer.verification !== "accredited_employer" && draft.visaAccepted?.includes("aewv")) {
    findings.push({
      level: "block",
      field: "visaAccepted",
      rule: "aewv_unaccredited",
      message_zh: t.aewvUnaccredited.message,
    });
  }

  for (const field of TEXT_FIELDS) {
    const text = draft[field];
    if (!text) continue;
    for (const rule of WORD_RULES[country]) {
      const matches = findWords(text, rule);
      if (!matches.length) continue;
      findings.push({
        level: rule.level,
        field,
        rule: rule.rule,
        matches,
        message_zh: t.rules[rule.rule](matches.map((w) => t.words.quote(w)).join(t.words.joiner)),
      });
    }
  }

  return findings.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
}

export const CHAT_RULES: readonly ChatFinding["rule"][] = ["fee", "visa_selling", "task_scam", "ethnic_preference"];
const isChatRule = (rule: WordRule["rule"]): rule is ChatFinding["rule"] =>
  CHAT_RULES.includes(rule as ChatFinding["rule"]);

/** Fee, visa-selling, task-scam and ethnic words in one chat message, so the chat can warn about them. */
export function checkChatMessage(text: string, country: CountryCode = "NZ"): ChatFinding[] {
  const findings: ChatFinding[] = [];
  for (const { rule, ...wordRule } of WORD_RULES[country]) {
    if (!isChatRule(rule)) continue;
    const matches = findWords(text, { rule, ...wordRule });
    if (matches.length) findings.push({ rule, matches });
  }
  return findings;
}

/** Blocks and rewrites hold publishing; review findings publish as pending review. */
export function publishDecision(findings: Finding[]): { canPublish: boolean; status: "active" | "pending_review" } {
  return {
    canPublish: !findings.some((f) => f.level === "block" || f.level === "rewrite"),
    status: findings.some((f) => f.level === "review") ? "pending_review" : "active",
  };
}
