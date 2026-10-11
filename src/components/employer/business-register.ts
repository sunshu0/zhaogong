// A demo stand-in for the NZ Companies Office / NZBN lookup. The register is the register details
// of the demo employers plus a few extra companies, so every verification outcome can be shown.
import type { Employer } from "@/lib/types";

export interface RegisterEntry {
  nzbn: string;
  legalName: string;
  tradingNames: string[];
  status: "registered" | "removed";
}

/** Companies the demo employers do not carry yet: two unverified shops, one off the platform, one struck off. */
const DEMO_EXTRAS: RegisterEntry[] = [
  { nzbn: "9429000000004", legalName: "Demo Yuemei Hair Studio Limited", tradingNames: ["悦美发型工作室", "Yuemei Hair"], status: "registered" },
  { nzbn: "9429000000006", legalName: "Demo Jiejing Home Services Limited", tradingNames: ["洁净家政"], status: "registered" },
  { nzbn: "9429000000010", legalName: "Demo Kiwi Noodle House Limited", tradingNames: ["新西兰面馆"], status: "registered" },
  { nzbn: "9429000000099", legalName: "Demo Golden Dragon Restaurant Limited", tradingNames: ["金龙酒家"], status: "removed" },
];

export function buildRegister(employers: Employer[]): RegisterEntry[] {
  const fromEmployers: RegisterEntry[] = employers
    .filter((e) => e.businessNumber && e.legalName)
    .map((e) => ({ nzbn: e.businessNumber!, legalName: e.legalName!, tradingNames: [e.name], status: "registered" }));
  const seen = new Set(fromEmployers.map((e) => e.nzbn));
  return [...fromEmployers, ...DEMO_EXTRAS.filter((e) => !seen.has(e.nzbn))];
}

export const normalizeNzbn = (s: string) => s.replace(/[\s-]/g, "");

const MAX_RESULTS = 5;

export function searchRegister(register: RegisterEntry[], query: string): { results: RegisterEntry[]; error_zh?: string } {
  const q = query.trim();
  const digits = normalizeNzbn(q);
  if (/^\d+$/.test(digits)) {
    if (digits.length !== 13) return { results: [], error_zh: "NZBN 是 13 位数字，请检查一下。" };
    const found = register.filter((e) => e.nzbn === digits);
    return found.length ? { results: found } : { results: [], error_zh: "企业登记里没有这个 NZBN。" };
  }
  if ([...q].length < 2) return { results: [], error_zh: "请至少输入两个字。" };
  const needle = q.toLowerCase();
  const results = register
    .filter((e) => [e.legalName, ...e.tradingNames].some((n) => n.toLowerCase().includes(needle)))
    .slice(0, MAX_RESULTS);
  return results.length ? { results } : { results: [], error_zh: "企业登记里没有找到，请换个名称或直接输入 NZBN。" };
}
