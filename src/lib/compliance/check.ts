// Compliance check run on every draft before it can be published. Pure functions, no I/O.
import { COUNTRIES } from "@/config/countries";
import type { CountryCode } from "@/lib/types";
import { WORD_RULES, type WordRule } from "./rules";
import type { Finding, FindingLevel, JobDraft } from "./types";

const TEXT_FIELDS = ["titleZh", "titleEn", "shiftsZh", "address", "descriptionZh", "descriptionEn"] as const;

const LEVEL_ORDER: Record<FindingLevel, number> = { block: 0, rewrite: 1, review: 2 };

/** Spaces and symbols people put between characters to get past a filter, e.g. 包 签, 押*金. */
const FILLER = /[\s\u200b-\u200d\ufeff*\u00b7\u2022._\-~|\\/]+/g;
/** Joins two words of the same list: 押金和介绍费. Commas are left out on purpose: 不收介绍费，押金500. */
const JOINER_END = /[和、或及与跟]$/;
const JOINER_START = /^[和、或及与跟]/;

const NEGATED_BEFORE_ZH = /(不|无|免|零|没有|拒绝|绝不)(收取|收|取|需要|需|要|用|交|付|设|任何|额外|另外|另)*$/;
const NEGATED_AFTER_ZH = /^[:：]?(全免|全无|免|无|不收|为零|为0|0元)/;
const NEGATED_BEFORE_EN =
  /\b(no|not|never|without|zero|free of|don't|do not|doesn't|does not|won't|will not)(\s+(charge|charges|charging|ask|asking|require|requires|required|need|needs|take|takes|pay|for|any|a|an|or|and))*\s*$/;
const NEGATED_AFTER_EN = /^\s+((is|are)\s+)?(not\s+(required|needed|charged)|waived|free)\b/;

const isLatin = (word: string) => /^[\x20-\x7e]+$/.test(word);
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const money = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

function negatedZh(text: string, start: number, end: number, rule: WordRule): boolean {
  const cjkWords = rule.words.filter((w) => !isLatin(w));
  // Step back over other words of the same list, so 不收押金和介绍费 negates both.
  let before = text.slice(0, start);
  for (;;) {
    const trimmed = before.replace(JOINER_END, "");
    const word = cjkWords.find((w) => trimmed.endsWith(w));
    if (!word) break;
    before = trimmed.slice(0, -word.length);
  }
  let after = text.slice(end);
  for (;;) {
    const trimmed = after.replace(JOINER_START, "");
    const word = cjkWords.find((w) => trimmed.startsWith(w));
    if (!word) break;
    after = trimmed.slice(word.length);
  }
  return NEGATED_BEFORE_ZH.test(before.slice(-8)) || NEGATED_AFTER_ZH.test(after);
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
  const compact = normal.replace(FILLER, "");
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
      if (latin ? negatedEn(haystack, start, end) : negatedZh(haystack, start, end, rule)) continue;
      hits.push({ start, end, word, latin });
    }
  }
  return [...new Set(hits.sort((a, b) => a.start - b.start).map((h) => h.word))];
}

/** Everything that stops or holds this draft, most serious first. An empty list means it can go live. */
export function checkJob(draft: JobDraft, country: CountryCode): Finding[] {
  const config = COUNTRIES[country];
  const findings: Finding[] = [];

  const wage = config.minimumWage;
  if (draft.pay && wage.hourly > 0 && draft.pay.min < wage.hourly) {
    const sym = config.currencySymbol;
    findings.push({
      level: "block",
      field: "pay",
      rule: "min_wage",
      message_zh: `时薪 ${sym}${money(draft.pay.min)} 低于${config.nameZh}最低工资 ${sym}${money(wage.hourly)}（${wage.effectiveFrom} 起），请调高后再发布。`,
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
        message_zh: rule.message_zh.replace("{words}", matches.map((w) => `「${w}」`).join("")),
      });
    }
  }

  return findings.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
}

/** Blocks and rewrites hold publishing; review findings publish as pending review. */
export function publishDecision(findings: Finding[]): { canPublish: boolean; status: "active" | "pending_review" } {
  return {
    canPublish: !findings.some((f) => f.level === "block" || f.level === "rewrite"),
    status: findings.some((f) => f.level === "review") ? "pending_review" : "active",
  };
}
