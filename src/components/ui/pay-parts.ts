import { payAmount } from "@/components/seeker/format";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { seekerJobsMessages } from "@/i18n/messages/seeker-jobs";
import type { CountryCode, PayRange } from "@/lib/types";

/** The pay for display, amount and unit apart: { amount: "$25–27", unit: "/小时" } or { …, unit: " an hour" }. */
export function payParts(
  pay: PayRange,
  country: CountryCode,
  lang: Lang = DEFAULT_LANG,
): { amount: string; unit: string } {
  return { amount: payAmount(pay, country, lang), unit: pick(seekerJobsMessages, lang).pay.hourUnit };
}
