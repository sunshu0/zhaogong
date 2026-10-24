import { COUNTRIES } from "@/config/countries";
import { INDUSTRY_LABELS } from "@/i18n/labels";
import { dateFormat, formatAmount } from "@/i18n/format";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { uiMessages } from "@/i18n/messages/ui";
import { belowMedianHint, MIN_SAMPLE, type PayReference } from "@/lib/pay-reference";
import type { CountryCode, Industry } from "@/lib/types";

const UPDATED: Intl.DateTimeFormatOptions = { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" };

/**
 * 时薪参考 (#85, R-36): lowest, median and highest pay of open jobs in the same industry, with the sample size, where
 * it comes from and when it was worked out. With `rate` (the employer's own pay), a hint below the median. Shared by
 * job pages and the post form; no hooks, so it renders on the server too. `look="card"` is the job page's (Round 19):
 * a card like the page's other blocks, the three figures side by side; the post form keeps the plain box.
 */
export function PayReferenceBox({
  reference,
  at,
  country,
  industry,
  rate,
  look = "box",
  lang = DEFAULT_LANG,
}: {
  reference: PayReference;
  /** When the reference was worked out (ISO). */
  at: string;
  country: CountryCode;
  industry: Industry;
  rate?: number;
  look?: "box" | "card" | "sheet";
  /** The page's language (Round 20): it renders on the server and in the browser, so it is told rather than asking. */
  lang?: Lang;
}) {
  const t = pick(uiMessages, lang).payReference;
  const symbol = COUNTRIES[country].currencySymbol;
  const money = (n: number) => `${symbol}${formatAmount(n, lang)}`;
  const label = INDUSTRY_LABELS[industry][lang];
  const hint = belowMedianHint(rate, reference) && t.belowMedian;
  const card = look !== "box";
  return (
    <section
      aria-label={t.title}
      className={
        look === "sheet"
          ? "p-4 text-body lg:px-7 lg:py-5"
          : card
            ? "rounded-card bg-surface p-4 text-body shadow-card lg:p-6"
            : "rounded-md border border-border bg-background px-3 py-2 text-body"
      }
    >
      {reference.scope === "none" ? (
        <p className="text-muted">{t.tooFew(label, reference.count, MIN_SAMPLE)}</p>
      ) : (
        <>
          <p className={card ? "font-semibold" : "font-medium"}>
            {t.title}{" "}
            <span className="font-normal text-muted">
              · {lang === "en" ? reference.placeEn : reference.place} · {label}
            </span>
          </p>
          <dl className={card ? "mt-3 grid grid-cols-3 gap-x-4" : "mt-1 flex flex-wrap gap-x-4 gap-y-0.5"}>
            {(
              [
                [t.lowest, reference.min],
                [t.median, reference.median],
                [t.highest, reference.max],
              ] as const
            ).map(([term, n]) => (
              <div key={term} className={card ? "min-w-0" : "flex gap-1.5"}>
                <dt className={card ? "text-meta text-muted" : "text-muted"}>{term}</dt>
                <dd className={card ? "mt-0.5 font-figure text-subtitle font-semibold" : "font-figure"}>{money(n)}</dd>
              </div>
            ))}
          </dl>
          {hint && (
            <p role="note" className="mt-1 text-warn">
              {hint}
            </p>
          )}
        </>
      )}
      <p className={card ? "mt-3 text-meta text-muted" : "mt-1 text-meta text-muted"}>
        {t.basis(reference.count, label, dateFormat(lang, UPDATED).format(new Date(at)))}
      </p>
    </section>
  );
}
