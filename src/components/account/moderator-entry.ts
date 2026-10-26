import type { Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { accountMessages } from "@/i18n/messages/account";

/**
 * The link to the moderation pages (#73), offered only to a staff account (ADR 0043: the session's `staff`, which
 * the server sets); adminEntry(lang) to name it.
 */
export const ADMIN_HREF = "/admin";

/** The same link named in the page's language: 审核后台 / Moderation. */
export function adminEntry(lang: Lang): { href: string; label: string } {
  return { href: ADMIN_HREF, label: pick(accountMessages, lang).rows.admin };
}
