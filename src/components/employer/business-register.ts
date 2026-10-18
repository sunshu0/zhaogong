// A demo stand-in for the NZ Companies Office / NZBN lookup. The register is the register details
// of the demo employers plus a few extra companies, so every verification outcome can be shown.
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { employerVerifyMessages } from "@/i18n/messages/employer-verify";
import type { Employer } from "@/lib/types";

export interface RegisterEntry {
  nzbn: string;
  legalName: string;
  tradingNames: string[];
  status: "registered" | "removed";
}

/** Companies the demo employers do not carry yet: two unverified shops, one off the platform, one struck off. */
const DEMO_EXTRAS: RegisterEntry[] = [
  {
    nzbn: "9429000000004",
    legalName: "Demo Yuemei Hair Studio Limited",
    tradingNames: ["悦美发型工作室", "Yuemei Hair"],
    status: "registered",
  },
  {
    nzbn: "9429000000006",
    legalName: "Demo Jiejing Home Services Limited",
    tradingNames: ["洁净家政"],
    status: "registered",
  },
  {
    nzbn: "9429000000010",
    legalName: "Demo Kiwi Noodle House Limited",
    tradingNames: ["新西兰面馆"],
    status: "registered",
  },
  {
    nzbn: "9429000000099",
    legalName: "Demo Golden Dragon Restaurant Limited",
    tradingNames: ["金龙酒家"],
    status: "removed",
  },
];

export function buildRegister(employers: Employer[]): RegisterEntry[] {
  const fromEmployers: RegisterEntry[] = employers
    .filter((e) => e.businessNumber && e.legalName)
    .map((e) => ({ nzbn: e.businessNumber!, legalName: e.legalName!, tradingNames: [e.name], status: "registered" }));
  const seen = new Set(fromEmployers.map((e) => e.nzbn));
  return [...fromEmployers, ...DEMO_EXTRAS.filter((e) => !seen.has(e.nzbn))];
}

export const normalizeNzbn = (s: string) => s.replace(/[\s-]/g, "");

/**
 * Demo only: every NZBN 9429999xxxxxx is a registered company of its own, so each browser test (and anyone trying
 * the demo) can apply for 企业验证 with a company nobody else has used (#78). The real lookup replaces all of this.
 */
const DEMO_RANGE = /^9429999\d{6}$/;

function demoRangeEntry(nzbn: string): RegisterEntry | undefined {
  if (!DEMO_RANGE.test(nzbn)) return undefined;
  return {
    nzbn,
    legalName: `Demo Company ${nzbn.slice(-6)} Limited`,
    tradingNames: [`示例公司 ${nzbn.slice(-6)}`],
    status: "registered",
  };
}

/** The register's entry for an NZBN, if it has one. */
export function findInRegister(register: RegisterEntry[], nzbn: string): RegisterEntry | undefined {
  const number = normalizeNzbn(nzbn);
  return register.find((e) => e.nzbn === number) ?? demoRangeEntry(number);
}

const MAX_RESULTS = 5;

export function searchRegister(
  register: RegisterEntry[],
  query: string,
  lang: Lang = DEFAULT_LANG,
): { results: RegisterEntry[]; error_zh?: string } {
  const t = pick(employerVerifyMessages, lang).register;
  const q = query.trim();
  const digits = normalizeNzbn(q);
  if (/^\d+$/.test(digits)) {
    if (digits.length !== 13) return { results: [], error_zh: t.nzbnLength };
    const found = findInRegister(register, digits);
    return found ? { results: [found] } : { results: [], error_zh: t.nzbnNotFound };
  }
  if ([...q].length < 2) return { results: [], error_zh: t.queryTooShort };
  const needle = q.toLowerCase();
  const results = register
    .filter((e) => [e.legalName, ...e.tradingNames].some((n) => n.toLowerCase().includes(needle)))
    .slice(0, MAX_RESULTS);
  return results.length ? { results } : { results: [], error_zh: t.nameNotFound };
}
