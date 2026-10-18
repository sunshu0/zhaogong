// 邮箱拼错 (#185): a code sent to a mistyped address never arrives, and the user only sees that nothing came. The
// sign-in page offers the right spelling for the domains below, and never stops the sending. Only spellings that are
// certainly typos of the common mail services are here; no guessing from distance, so real services that look
// alike (gmx.com, mail.com, yeah.net, foxmail.com, yahoo.co.nz) are never "corrected".
import { normalizeEmail } from "@/components/seeker/session";

const TYPOS: Record<string, string[]> = {
  "gmail.com": [
    "gmial.com",
    "gamil.com",
    "gmai.com",
    "gmal.com",
    "gmaill.com",
    "gmali.com",
    "gnail.com",
    "gmail.co",
    "gmail.con",
    "gmail.cm",
    "gmail.om",
    "gmail.comm",
    "gmail.cmo",
  ],
  "hotmail.com": ["hotmial.com", "hotmal.com", "hotmai.com", "hotamil.com", "hotmali.com", "hotmail.con"],
  "outlook.com": ["outlok.com", "outllok.com", "outlool.com", "outloook.com", "outlook.con"],
  "qq.com": ["qq.con", "qq.cm", "qq.cmo", "qq.comm"],
  "163.com": ["163.con", "163.cm", "163.cmo"],
  "126.com": ["126.con", "126.cm", "126.cmo"],
  "icloud.com": ["iclould.com", "icoud.com", "icluod.com", "icloud.con"],
  "yahoo.com": ["yaho.com", "yahooo.com", "yahoo.con"],
  "xtra.co.nz": ["xtra.co.n", "xtra.conz", "xtra.co.nzz", "xtra.co.nz.com"],
};

const FIXES = new Map(Object.entries(TYPOS).flatMap(([right, wrong]) => wrong.map((w) => [w, right] as const)));

/** The address with its domain spelled right, when the domain is one of the typos above; else null. */
export function emailTypoFix(email: string): string | null {
  const address = normalizeEmail(email);
  const at = address.lastIndexOf("@");
  if (at <= 0) return null;
  const right = FIXES.get(address.slice(at + 1));
  return right ? `${address.slice(0, at)}@${right}` : null;
}
