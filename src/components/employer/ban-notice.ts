// What a banned business's team reads in place of its tools (ADR 0044). The employer comes from the server through
// currentBan, so bannedAt here means banned now; a temporary ban says until when and why.
import { formatDate } from "@/i18n/format";
import type { Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { employerCommonMessages } from "@/i18n/messages/employer-common";
import type { Employer } from "@/lib/types";

const UNTIL: Intl.DateTimeFormatOptions = { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" };

/** The notice for this business, or undefined when it is not banned. `permanent`: the page's own words for that. */
export function banNotice(
  employer: Pick<Employer, "bannedAt" | "bannedUntil" | "banReason"> | undefined | null,
  lang: Lang,
  permanent: string,
): string | undefined {
  if (!employer?.bannedAt) return undefined;
  if (!employer.bannedUntil) return permanent;
  return pick(employerCommonMessages, lang).errors.tempBanned(
    formatDate(employer.bannedUntil, lang, UNTIL),
    employer.banReason ?? "",
  );
}
