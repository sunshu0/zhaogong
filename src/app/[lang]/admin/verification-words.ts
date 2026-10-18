// 企业验证 on /admin in the reader's language (Round 20 step 2, #236). The checklist, the rejection reasons and the
// badge names belong to the business verification pages (B's employer-verify dictionary and i18n/labels.ts); /admin
// reads them from there. checklistFor() builds the items in Chinese; checklistIn() puts each one, and its links in
// order, into the language asked for, matched by the item's id.
import type { CheckId, CheckItem, RejectReason, VerifyKind } from "@/components/employer/verification";
import { VERIFICATION_LABELS } from "@/i18n/labels";
import type { Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { employerVerifyMessages } from "@/i18n/messages/employer-verify";

/** Each item's links in the order checklistFor() lists them, by their key in the dictionary. */
const LINK_KEYS: Record<CheckId, readonly string[]> = {
  register: ["nzbnLink", "companiesOfficeLink"],
  applicant: ["directorsLink"],
  phone: ["mapsLink"],
  website: [],
  accredited: ["listLink"],
};

export function checklistIn(items: readonly CheckItem[], lang: Lang): CheckItem[] {
  const t = pick(employerVerifyMessages, lang).checklist;
  return items.map((item) => {
    const words: Record<string, string> = t[item.id];
    const keys = LINK_KEYS[item.id];
    return {
      ...item,
      label: words.label,
      detail: words.detail,
      links: item.links.map((link, i) => ({ ...link, label: (keys[i] && words[keys[i]]) || link.label })),
    };
  });
}

/** The badge applied for: 已验证企业 / Verified business, 认证雇主 / Accredited employer. */
export function badgeName(kind: VerifyKind, lang: Lang): string {
  return VERIFICATION_LABELS[kind][lang];
}

/** Why an application was turned down; the employer sees these too. */
export function rejectReasonsIn(lang: Lang): Record<RejectReason, string> {
  return pick(employerVerifyMessages, lang).rejectReasons;
}
