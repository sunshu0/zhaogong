import { COUNTRIES, regionById } from "@/config/countries";
import { LANGUAGE_LABELS, VISA_LABELS } from "@/i18n/labels";
import { formatEmploymentTypes } from "@/lib/employment-types";
import { missingFields } from "@/lib/ai-post";
import { checkJob, publishDecision, type JobDraft } from "@/lib/compliance";
import type { CountryCode } from "@/lib/types";

const money = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
const range = (r: { min: number; max?: number }, f: (n: number) => string = String) =>
  r.max != null && r.max !== r.min ? `${f(r.min)}–${f(r.max)}` : f(r.min);

function Row({ label, value }: { label: string; value?: string | false | 0 }) {
  return (
    <div className="flex gap-3 py-1.5">
      <dt className="w-16 shrink-0 text-muted">{label}</dt>
      <dd className={value ? "" : "text-warn"}>{value || "待填"}</dd>
    </div>
  );
}

/** The job as the conversation has filled it so far. Not a live region: the chat already speaks. */
export function DraftCard({ draft, country }: { draft: JobDraft; country: CountryCode }) {
  const findings = checkJob(draft, country);
  const missing = missingFields(draft);
  const decision = publishDecision(findings);
  const ready = decision.canPublish && missing.length === 0;
  const contact = [draft.contact?.phone && "电话", draft.contact?.wechat && "微信", draft.contact?.email && "邮箱"].filter(Boolean).join("、");
  const perks = [draft.mealsIncluded && "包餐", draft.accommodationIncluded && "包住"].filter(Boolean).join("、");
  const perksKnown = draft.mealsIncluded != null || draft.accommodationIncluded != null;

  return (
    <section aria-label="职位卡，随对话更新" className="rounded-xl border border-border bg-surface p-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{draft.titleZh ?? "职位名称待填"}</h2>
          {draft.titleEn && (
            <p lang="en" className="text-xs text-muted">
              {draft.titleEn}
            </p>
          )}
        </div>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${ready ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"}`}>
          {ready ? "可以预览" : `还差 ${missing.length + findings.filter((f) => f.level !== "review").length} 项`}
        </span>
      </div>
      <dl className="mt-2 divide-y divide-border">
        <Row label="时薪" value={draft.pay && `${COUNTRIES[country].currencySymbol}${range(draft.pay, money)}/小时`} />
        <Row label="地区" value={draft.regionId && regionById(country, draft.regionId)?.nameZh} />
        <Row label="类型" value={formatEmploymentTypes(draft.employmentType)} />
        <Row label="工时" value={draft.hoursPerWeek ? `每周 ${range(draft.hoursPerWeek)} 小时` : "可不填"} />
        <Row label="食宿" value={perksKnown ? perks || "不包吃住" : "可不填"} />
        <Row label="签证" value={draft.visaAccepted?.length ? draft.visaAccepted.map((v) => VISA_LABELS[v].zh).join("、") : undefined} />
        <Row label="语言" value={draft.languages?.length ? draft.languages.map((l) => LANGUAGE_LABELS[l].zh).join("、") : "可不填"} />
        <Row label="联系" value={contact ? `${contact}（登录后可见）` : undefined} />
      </dl>
      {decision.status === "pending_review" && <p className="mt-2 text-xs text-warn">这个职位发布后要人工审核。</p>}
    </section>
  );
}
