"use client";

import { useState } from "react";
import {
  FUNNEL_DAYS,
  GROUPS,
  type Breakdown,
  type Cell,
  type FunnelDays,
  type FunnelReport,
} from "@/app/[lang]/admin/funnels";
import { getFunnels } from "@/app/[lang]/admin/stats-actions";
import type { Refused } from "@/app/[lang]/admin/actions";
import { Empty, Loading } from "@/app/[lang]/admin/_components/Empty";
import { LoadFailed } from "@/app/[lang]/admin/_components/Failed";
import { Radio } from "@/components/ui/Checkbox";
import { Section } from "@/components/ui/Section";
import { useServerLoad } from "@/components/ui/use-server-load";
import { useLang, useMessages } from "@/i18n/client";
import { formatNumber } from "@/i18n/format";
import { adminStatsMessages } from "@/i18n/messages/admin-stats";

/**
 * 审核数据's 漏斗 (#316, ADR 0025 §5): each flow's steps over the last 7 or 30 days, for everyone or split by the
 * page's language or the visitor's identity. Counts only; 1-4 read 「少于 5」, and a rate shows only between counts of
 * 5 or more (funnels.ts).
 */
export function Funnels() {
  const lang = useLang();
  const t = useMessages(adminStatsMessages).funnels;
  const [days, setDays] = useState<FunnelDays>(7);
  const [breakdown, setBreakdown] = useState<Breakdown>("all");
  const { value, failed, reload } = useServerLoad<FunnelReport | Refused>(`${days}`, () => getFunnels(days));
  const groups = GROUPS[breakdown];
  const cell = (count: Cell) => (count === "few" ? t.few : formatNumber(count, lang));

  return (
    <Section look="app" title={t.title} description={t.description}>
      <div className="flex flex-wrap gap-x-8 gap-y-2 py-group">
        <fieldset className="flex flex-wrap gap-x-5 text-body">
          <legend className="mb-1 text-meta text-muted">{t.period}</legend>
          {FUNNEL_DAYS.map((d) => (
            <Radio key={d} name="funnel-days" checked={days === d} onChange={() => setDays(d)}>
              {t.lastDays(d)}
            </Radio>
          ))}
        </fieldset>
        <fieldset className="flex flex-wrap gap-x-5 text-body">
          <legend className="mb-1 text-meta text-muted">{t.breakdown}</legend>
          {(Object.keys(GROUPS) as Breakdown[]).map((b) => (
            <Radio key={b} name="funnel-breakdown" checked={breakdown === b} onChange={() => setBreakdown(b)}>
              {t.breakdowns[b]}
            </Radio>
          ))}
        </fieldset>
      </div>

      {failed ? (
        <LoadFailed what={t.name} onRetry={reload} />
      ) : !value ? (
        <Loading cards={1} />
      ) : "refused" in value ? (
        <Empty>{value.error_zh}</Empty>
      ) : (
        <div className="space-y-6 pb-group">
          {value.funnels.map((funnel) => (
            <div key={funnel.id} role="region" aria-label={t.flows[funnel.id]} tabIndex={0} className="overflow-x-auto">
              <table className="w-full text-body">
                <caption className="pb-1 text-left font-medium">{t.flows[funnel.id]}</caption>
                <thead>
                  <tr className="border-b border-border text-left text-meta text-muted">
                    <th scope="col" className="py-2 pr-2 font-normal">
                      {t.step}
                    </th>
                    {groups.map((g) => (
                      <th key={g} scope="col" className="py-2 pr-2 text-right font-normal last:pr-0">
                        {t.groups[g]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {funnel.steps.map((step, i) => (
                    <tr key={step.names.join("|")}>
                      <th scope="row" className="py-2 pr-2 text-left font-normal">
                        {t.steps[funnel.id][i]}
                      </th>
                      {groups.map((g) => {
                        const rate = step.rates[g];
                        return (
                          <td key={g} className="py-2 pr-2 text-right whitespace-nowrap last:pr-0">
                            <span className="font-figure">{cell(step.counts[g])}</span>
                            {rate !== null && <span className="ml-1.5 text-meta text-muted">{t.rate(rate)}</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          <div role="region" aria-label={t.singlesTitle} tabIndex={0} className="overflow-x-auto">
            <table className="w-full text-body">
              <caption className="pb-1 text-left font-medium">{t.singlesTitle}</caption>
              <thead>
                <tr className="border-b border-border text-left text-meta text-muted">
                  <th scope="col" className="py-2 pr-2 font-normal">
                    {t.step}
                  </th>
                  {groups.map((g) => (
                    <th key={g} scope="col" className="py-2 pr-2 text-right font-normal last:pr-0">
                      {t.groups[g]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {value.singles.map((single) => (
                  <tr key={single.name}>
                    <th scope="row" className="py-2 pr-2 text-left font-normal">
                      {t.singles[single.name]}
                    </th>
                    {groups.map((g) => (
                      <td key={g} className="py-2 pr-2 text-right font-figure last:pr-0">
                        {cell(single.counts[g])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Section>
  );
}
