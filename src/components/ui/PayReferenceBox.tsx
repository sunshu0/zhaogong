import { COUNTRIES } from "@/config/countries";
import { INDUSTRY_LABELS } from "@/i18n/labels";
import { belowMedianHint, MIN_SAMPLE, type PayReference } from "@/lib/pay-reference";
import type { CountryCode, Industry } from "@/lib/types";

const updated = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Pacific/Auckland",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * 时薪参考 (#85, R-36): lowest, median and highest pay of open jobs in the same industry, with the sample size, where
 * it comes from and when it was worked out. With `rate` (the employer's own pay), a hint below the median. Shared by
 * job pages and the post form; no hooks, so it renders on the server too.
 */
export function PayReferenceBox({
  reference,
  at,
  country,
  industry,
  rate,
}: {
  reference: PayReference;
  /** When the reference was worked out (ISO). */
  at: string;
  country: CountryCode;
  industry: Industry;
  rate?: number;
}) {
  const symbol = COUNTRIES[country].currencySymbol;
  const money = (n: number) => `${symbol}${Number.isInteger(n) ? n : n.toFixed(2)}`;
  const label = INDUSTRY_LABELS[industry].zh;
  const hint = belowMedianHint(rate, reference);
  return (
    <section aria-label="同类职位时薪" className="rounded-md border border-border bg-background px-3 py-2 text-body">
      {reference.scope === "none" ? (
        <p className="text-muted">
          同类职位时薪：样本太少（平台上{label}在招职位只有 {reference.count} 个，少于 {MIN_SAMPLE} 个），暂不显示。
        </p>
      ) : (
        <>
          <p className="font-medium">
            同类职位时薪{" "}
            <span className="font-normal text-muted">
              · {reference.place} · {label}
            </span>
          </p>
          <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
            {(
              [
                ["最低", reference.min],
                ["中位数", reference.median],
                ["最高", reference.max],
              ] as const
            ).map(([term, n]) => (
              <div key={term} className="flex gap-1.5">
                <dt className="text-muted">{term}</dt>
                <dd className="font-figure">{money(n)}</dd>
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
      <p className="mt-1 text-meta text-muted">
        根据平台上 {reference.count} 个在招的{label}职位计算（职位时薪取范围中间值），不含外部数据，
        {updated.format(new Date(at))}更新。
      </p>
    </section>
  );
}
