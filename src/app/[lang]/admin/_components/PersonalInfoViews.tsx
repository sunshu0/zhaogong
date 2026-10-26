"use client";

import { useState } from "react";
import { getPersonalInfoViews, type PersonalInfoViewList } from "@/app/[lang]/admin/views-actions";
import { LIST_LIMIT, VIEW_DAYS, type ViewDays } from "@/lib/personal-info-views";
import { moderatorLabel } from "@/app/[lang]/admin/moderation";
import type { Refused } from "@/app/[lang]/admin/actions";
import { Empty, Loading } from "@/app/[lang]/admin/_components/Empty";
import { LoadFailed } from "@/app/[lang]/admin/_components/Failed";
import { Radio } from "@/components/ui/Checkbox";
import { Section } from "@/components/ui/Section";
import { Select } from "@/components/ui/Select";
import { useServerLoad } from "@/components/ui/use-server-load";
import { useLang, useMessages } from "@/i18n/client";
import { formatDate } from "@/i18n/format";
import { adminViewsMessages } from "@/i18n/messages/admin-views";

// When a record was made: day and time, New Zealand time (format.ts).
const TIME: Intl.DateTimeFormatOptions = { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" };

/**
 * 查看记录 (#336, ADR 0026): whose personal information /admin handed which moderator, newest first, for one
 * moderator or all of them over the last 7, 30 or 365 days. Ids only, never the information.
 */
export function PersonalInfoViews() {
  const lang = useLang();
  const t = useMessages(adminViewsMessages);
  const [days, setDays] = useState<ViewDays>(VIEW_DAYS[0]);
  const [moderator, setModerator] = useState("");
  const { value, failed, reload } = useServerLoad<PersonalInfoViewList | Refused>(`${moderator}|${days}`, () =>
    getPersonalInfoViews(moderator, days),
  );
  // The filter keeps the last list of moderators while the next answer is on its way.
  const [moderators, setModerators] = useState<string[]>([]);
  const list = value && !("refused" in value) ? value : undefined;
  if (list && list.moderators.join() !== moderators.join()) setModerators(list.moderators);

  return (
    <Section look="sheet" title={t.title} description={t.description}>
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3 py-group">
        <div className="w-full max-w-xs">
          <Select
            label={t.moderator}
            placeholder={t.everyone}
            options={moderators.map((m) => ({ value: m, label: moderatorLabel(m, lang) }))}
            value={moderator}
            onChange={setModerator}
          />
        </div>
        <fieldset className="flex flex-wrap gap-x-5 text-body">
          <legend className="mb-1 text-meta text-muted">{t.period}</legend>
          {VIEW_DAYS.map((d) => (
            <Radio key={d} name="views-days" checked={days === d} onChange={() => setDays(d)}>
              {t.lastDays(d)}
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
      ) : value.views.length === 0 ? (
        <p className="pb-group text-body text-muted">{t.empty}</p>
      ) : (
        <div className="space-y-2 pb-group">
          <div role="region" aria-label={t.title} tabIndex={0} className="overflow-x-auto">
            <table className="w-full text-body">
              <caption className="pb-1 text-left text-meta text-muted">{t.caption(value.views.length)}</caption>
              <thead>
                <tr className="border-b border-border text-left text-meta text-muted">
                  <th scope="col" className="py-2 pr-3 font-normal">
                    {t.columns.at}
                  </th>
                  <th scope="col" className="py-2 pr-3 font-normal">
                    {t.columns.moderator}
                  </th>
                  <th scope="col" className="py-2 pr-3 font-normal">
                    {t.columns.kind}
                  </th>
                  <th scope="col" className="py-2 font-normal">
                    {t.columns.subject}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {value.views.map((v) => (
                  <tr key={`${v.at}|${v.moderator}|${v.kind}|${v.subjectId}`}>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <time dateTime={v.at}>{formatDate(v.at, lang, TIME)}</time>
                    </td>
                    <td className="py-2 pr-3 break-all">{moderatorLabel(v.moderator, lang)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{t.kinds[v.kind]}</td>
                    <td className="py-2 font-mono text-meta break-all">{v.subjectId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {value.more && <p className="text-meta text-muted">{t.more(LIST_LIMIT)}</p>}
        </div>
      )}
    </Section>
  );
}
