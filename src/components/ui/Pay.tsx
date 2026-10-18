import { payParts } from "@/components/ui/pay-parts";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import type { CountryCode, PayRange } from "@/lib/types";

const SIZES = {
  /** Job lists and cards. */
  card: "text-[1.875rem]",
  /** The job page. */
  detail: "text-[2.5rem]",
  /** The home page's window notices. */
  notice: "text-[2.875rem]",
} as const;

/**
 * Pay, the first thing on every job (Round 13): a large narrow figure in brand colour with a small grey 「/小时」.
 * The same on job lists, the job page and the home page's notices. Example: `<Pay pay={job.pay} country={job.country} />`.
 */
export function Pay({
  pay,
  country,
  size = "card",
  className = "",
  lang = DEFAULT_LANG,
}: {
  pay: PayRange;
  country: CountryCode;
  size?: keyof typeof SIZES;
  className?: string;
  /** The page's language (Round 20): 「/小时」 or 「 an hour」. */
  lang?: Lang;
}) {
  const { amount, unit } = payParts(pay, country, lang);
  return (
    <span className={`inline-flex items-baseline whitespace-nowrap text-brand ${className}`.trim()}>
      <span className={`font-figure ${SIZES[size]}`}>{amount}</span>
      {unit && <span className="ml-0.5 text-meta font-medium text-muted">{unit}</span>}
    </span>
  );
}
