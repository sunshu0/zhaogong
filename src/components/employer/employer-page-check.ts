// 企业主页 must be fit to be public (#195): it is shown signed out too. Server side only (page-actions.ts): it
// pulls in the posting parser's contact patterns, which the browser does not need. Pure.
import { checkChatMessage } from "@/lib/compliance";
import { readContact } from "@/lib/ai-post/parse";
import type { CountryCode } from "@/lib/types";
import type { EmployerPage, EmployerPageField } from "@/components/employer/employer-page";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { employerPageMessages } from "@/i18n/messages/employer-page";

/** The page's text fields, in the order a finding list walks them. */
const PAGE_TEXT_FIELDS = [
  "name",
  "headline",
  "bio",
  "location",
  "contactName",
  "languages",
  "availability",
] as const satisfies readonly Exclude<EmployerPageField, "avatar">[];

/** Something on the page that cannot be public (#195): which field, and what to change. */
export type PageFinding = { field: EmployerPageField; message_zh: string };

/**
 * What stops a page from being saved (#195): it is public, signed out too. The words a chat warns about (fees, visa
 * selling, ethnic preference), and contact details — those are for signed-in job seekers only, set on each job
 * (ADR 0002). Empty when the page can be saved.
 */
export function checkEmployerPage(
  page: EmployerPage,
  country: CountryCode = "NZ",
  lang: Lang = DEFAULT_LANG,
): PageFinding[] {
  const t = pick(employerPageMessages, lang).pageCheck;
  const findings: PageFinding[] = [];
  for (const field of PAGE_TEXT_FIELDS) {
    const text = page[field];
    if (!text) continue;
    const label = t.fieldLabel[field];
    for (const { rule, matches } of checkChatMessage(text, country))
      findings.push({ field, message_zh: t.ruleFinding(label, t.matchedWords(matches), t.rule[rule]) });
    const contact = Object.values(readContact(text));
    if (contact.length) findings.push({ field, message_zh: t.contactFinding(label, t.contactList(contact)) });
  }
  return findings;
}
