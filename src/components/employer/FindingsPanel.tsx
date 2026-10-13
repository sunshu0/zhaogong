import type { RequiredField } from "@/lib/ai-post";
import type { Finding, FindingLevel, JobDraft } from "@/lib/compliance";

export const FIELD_LABELS: Partial<Record<keyof JobDraft, string>> = {
  titleZh: "中文职位名称",
  titleEn: "英文职位名称",
  industry: "行业",
  employmentType: "工作类型",
  regionId: "地区",
  address: "地址",
  pay: "时薪",
  hoursPerWeek: "每周工时",
  shiftsZh: "班次",
  visaAccepted: "可接受的签证",
  languages: "语言要求",
  descriptionZh: "中文描述",
  descriptionEn: "英文描述",
  contact: "联系方式",
};

export const LEVEL_STYLES: Record<FindingLevel, { label: string; className: string }> = {
  block: { label: "不能发布", className: "bg-danger-soft text-danger" },
  rewrite: { label: "请改写", className: "bg-warn-soft text-warn" },
  review: { label: "需审核", className: "bg-brand-soft text-brand" },
};

export function FindingItem({ finding }: { finding: Finding }) {
  const style = LEVEL_STYLES[finding.level];
  return (
    <p className={`rounded-lg px-3 py-2 text-sm leading-relaxed ${style.className}`}>
      <span className="font-medium">{style.label}：</span>
      {finding.message_zh}
    </p>
  );
}

/** Everything that holds the draft, with links to the fields. */
export function FindingsPanel({ findings, missing }: { findings: Finding[]; missing: RequiredField[] }) {
  const clean = findings.length === 0 && missing.length === 0;
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="font-medium">发布前检查</h2>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {clean
          ? "发布前检查：没有发现问题"
          : `发布前检查：${[findings.length && `${findings.length} 个问题`, missing.length && `${missing.length} 项没填`].filter(Boolean).join("，")}`}
      </p>
      {clean ? (
        <p className="mt-2 rounded-lg bg-ok-soft px-3 py-2 text-sm text-ok">没有发现问题，可以预览发布。</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {findings.map((f, i) => (
            <li key={`${f.rule}-${f.field}-${i}`}>
              <a href={`#field-${f.field}`} className="block">
                <span className="mb-1 block text-xs text-muted">{FIELD_LABELS[f.field] ?? f.field}</span>
                <FindingItem finding={f} />
              </a>
            </li>
          ))}
          {missing.length > 0 && (
            <li className="rounded-lg border border-dashed border-warn px-3 py-2 text-sm">
              <span className="font-medium text-warn">还没填：</span>
              {missing.map((field, i) => (
                <span key={field}>
                  {i > 0 && "、"}
                  <a href={`#field-${field}`} className="underline">
                    {FIELD_LABELS[field]}
                  </a>
                </span>
              ))}
            </li>
          )}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted">
        检查最低工资和违规用词：收费、卖签证、按种族或国籍招人不能发布；部分行业要人工审核。
      </p>
    </section>
  );
}
