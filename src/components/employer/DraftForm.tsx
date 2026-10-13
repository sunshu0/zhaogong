"use client";
import type { ReactNode } from "react";
import { COUNTRIES } from "@/config/countries";
import { EMPLOYMENT_TYPE_LABELS, INDUSTRY_LABELS, LANGUAGE_LABELS, VISA_LABELS } from "@/i18n/labels";
import type { RequiredField } from "@/lib/ai-post";
import type { Finding, JobDraft } from "@/lib/compliance";
import type { CountryCode, EmploymentType, Industry, LanguageRequirement, VisaAccepted } from "@/lib/types";
import { FindingItem } from "@/components/employer/FindingsPanel";
import type { PostForm } from "@/components/employer/post-form";
import { employmentTypes, packEmploymentTypes } from "@/lib/employment-types";

type Props = {
  form: PostForm;
  set: (patch: Partial<PostForm>) => void;
  findings: Finding[];
  missing: RequiredField[];
  country: CountryCode;
  onRegenerateEn: () => void;
};

const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
const numberOrUndefined = (value: string) => (value === "" ? undefined : Number(value));

export function DraftForm({ form, set, findings, missing, country, onRegenerateEn }: Props) {
  const config = COUNTRIES[country];
  const wage = config.minimumWage;

  const state = (field: keyof JobDraft) => ({
    missing: (missing as (keyof JobDraft)[]).includes(field),
    findings: findings.filter((f) => f.field === field),
  });
  const box = (field: keyof JobDraft) => {
    const s = state(field);
    const tone = s.findings.some((f) => f.level !== "review")
      ? "border-danger"
      : s.missing
        ? "border-warn bg-warn-soft/40"
        : "border-border";
    return `w-full rounded-lg border bg-background px-3 ${tone}`;
  };

  return (
    <div className="space-y-6">
      <Section title="职位">
        <Field name="titleZh" label="职位名称（中文）" required {...state("titleZh")}>
          <input
            id="in-titleZh"
            value={form.titleZh}
            onChange={(e) => set({ titleZh: e.target.value })}
            placeholder="例如：前厅服务员"
            className={`h-11 ${box("titleZh")}`}
          />
        </Field>
        <Field name="titleEn" label="职位名称（英文）" required {...state("titleEn")}>
          <input
            id="in-titleEn"
            lang="en"
            value={form.titleEn}
            onChange={(e) => set({ titleEn: e.target.value })}
            placeholder="e.g. Front-of-house staff"
            className={`h-11 ${box("titleEn")}`}
          />
        </Field>
        <Field name="industry" label="行业" required {...state("industry")}>
          <select
            id="in-industry"
            value={form.industry ?? ""}
            onChange={(e) => set({ industry: (e.target.value || undefined) as Industry | undefined })}
            className={`h-11 ${box("industry")}`}
          >
            <option value="">请选择</option>
            {Object.entries(INDUSTRY_LABELS).map(([value, l]) => (
              <option key={value} value={value}>
                {l.zh}
              </option>
            ))}
          </select>
        </Field>
        <Group name="employmentType" legend="工作类型" required {...state("employmentType")}>
          <div className="flex flex-wrap gap-2">
            {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, l]) => (
              <Chip
                key={value}
                type="checkbox"
                name="employmentType"
                checked={employmentTypes(form.employmentType).includes(value as EmploymentType)}
                onChange={() =>
                  set({
                    employmentType: packEmploymentTypes(
                      toggle(employmentTypes(form.employmentType), value as EmploymentType),
                    ),
                  })
                }
              >
                {l.zh}
              </Chip>
            ))}
          </div>
        </Group>
        <Chip type="checkbox" checked={form.urgent} onChange={() => set({ urgent: !form.urgent })}>
          急招
        </Chip>
      </Section>

      <Section title="地点和时间">
        <Field name="regionId" label="地区" required {...state("regionId")}>
          <select
            id="in-regionId"
            value={form.regionId ?? ""}
            onChange={(e) => set({ regionId: e.target.value || undefined })}
            className={`h-11 ${box("regionId")}`}
          >
            <option value="">请选择</option>
            {config.regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nameZh}
              </option>
            ))}
          </select>
        </Field>
        <Field name="address" label="地址（可不填）" {...state("address")}>
          <input
            id="in-address"
            value={form.address}
            onChange={(e) => set({ address: e.target.value })}
            className={`h-11 ${box("address")}`}
          />
        </Field>
        <Group name="hoursPerWeek" legend="每周工时（可不填）" {...state("hoursPerWeek")}>
          <RangeInputs
            min={form.hoursMin}
            max={form.hoursMax}
            onMin={(v) => set({ hoursMin: v })}
            onMax={(v) => set({ hoursMax: v })}
            unit="小时"
            step="1"
            className={box("hoursPerWeek")}
          />
        </Group>
        <Field name="shiftsZh" label="班次（可不填）" {...state("shiftsZh")}>
          <input
            id="in-shiftsZh"
            value={form.shiftsZh}
            onChange={(e) => set({ shiftsZh: e.target.value })}
            placeholder="例如：周末晚班"
            className={`h-11 ${box("shiftsZh")}`}
          />
        </Field>
      </Section>

      <Section title="工资和福利">
        <Group
          name="pay"
          legend="时薪"
          required
          hint={`${config.nameZh}最低工资 ${config.currencySymbol}${wage.hourly}/小时（${wage.effectiveFrom} 起）。只有一个数就只填左边。`}
          {...state("pay")}
        >
          <RangeInputs
            min={form.payMin}
            max={form.payMax}
            onMin={(v) => set({ payMin: v })}
            onMax={(v) => set({ payMax: v })}
            unit={`${config.currencySymbol}/小时`}
            step="0.01"
            className={box("pay")}
          />
        </Group>
        <div className="flex flex-wrap gap-2">
          <Chip
            type="checkbox"
            checked={form.mealsIncluded}
            onChange={() => set({ mealsIncluded: !form.mealsIncluded })}
          >
            包餐
          </Chip>
          <Chip
            type="checkbox"
            checked={form.accommodationIncluded}
            onChange={() => set({ accommodationIncluded: !form.accommodationIncluded })}
          >
            包住
          </Chip>
        </div>
      </Section>

      <Section title="要求">
        <Group
          name="visaAccepted"
          legend="可接受的签证"
          required
          hint="只写你接受哪些签证。不要写办签证、包签这类内容。"
          {...state("visaAccepted")}
        >
          <div className="flex flex-wrap gap-2">
            {config.visaTypes.map((visa) => (
              <Chip
                key={visa}
                type="checkbox"
                checked={form.visaAccepted.includes(visa)}
                onChange={() => set({ visaAccepted: toggle<VisaAccepted>(form.visaAccepted, visa) })}
              >
                {VISA_LABELS[visa].zh}
              </Chip>
            ))}
          </div>
        </Group>
        <Group name="languages" legend="语言要求（可不选）" {...state("languages")}>
          <div className="flex flex-wrap gap-2">
            {Object.entries(LANGUAGE_LABELS).map(([value, l]) => (
              <Chip
                key={value}
                type="checkbox"
                checked={form.languages.includes(value as LanguageRequirement)}
                onChange={() => set({ languages: toggle(form.languages, value as LanguageRequirement) })}
              >
                {l.zh}
              </Chip>
            ))}
          </div>
        </Group>
      </Section>

      <Section title="职位描述">
        <Field name="descriptionZh" label="中文描述" required {...state("descriptionZh")}>
          <textarea
            id="in-descriptionZh"
            rows={5}
            value={form.descriptionZh}
            onChange={(e) => set({ descriptionZh: e.target.value })}
            className={`py-2 ${box("descriptionZh")}`}
          />
        </Field>
        <Field
          name="descriptionEn"
          label="英文描述"
          required
          hint="根据表格自动生成，可以修改。"
          {...state("descriptionEn")}
        >
          <textarea
            id="in-descriptionEn"
            lang="en"
            rows={4}
            value={form.descriptionEn}
            onChange={(e) => set({ descriptionEn: e.target.value })}
            className={`py-2 ${box("descriptionEn")}`}
          />
          <button type="button" onClick={onRegenerateEn} className="text-sm text-brand underline">
            按表格重新生成
          </button>
        </Field>
      </Section>

      <Section title="联系方式">
        <Group name="contact" legend="至少填一种" required hint="只有登录的求职者才能看到。" {...state("contact")}>
          <div className="space-y-2">
            {(
              [
                ["phone", "电话", "tel", "021 123 4567"],
                ["wechat", "微信号", "text", ""],
                ["email", "邮箱", "email", "name@example.com"],
              ] as const
            ).map(([key, label, type, placeholder]) => (
              <label key={key} className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-sm">{label}</span>
                <input
                  type={type}
                  value={form[key]}
                  onChange={(e) => set({ [key]: e.target.value })}
                  placeholder={placeholder}
                  className={`h-11 ${box("contact")}`}
                />
              </label>
            ))}
          </div>
        </Group>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl border border-border bg-surface p-4">
      <h2 className="font-medium">{title}</h2>
      {children}
    </section>
  );
}

type FieldState = { missing: boolean; findings: Finding[] };

function Notes({ missing, findings, hint }: FieldState & { hint?: string }) {
  return (
    <>
      {missing && <p className="text-xs text-warn">没有识别到，请填写</p>}
      {findings.map((f, i) => (
        <FindingItem key={i} finding={f} />
      ))}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </>
  );
}

function Field({
  name,
  label,
  required,
  hint,
  children,
  ...state
}: FieldState & { name: string; label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return (
    <div id={`field-${name}`} className="scroll-mt-20 space-y-1.5">
      <label htmlFor={`in-${name}`} className="block text-sm font-medium">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {children}
      <Notes {...state} hint={hint} />
    </div>
  );
}

function Group({
  name,
  legend,
  required,
  hint,
  children,
  ...state
}: FieldState & { name: string; legend: string; required?: boolean; hint?: string; children: ReactNode }) {
  return (
    <fieldset id={`field-${name}`} className="scroll-mt-20 space-y-1.5">
      <legend className="mb-1.5 text-sm font-medium">
        {legend}
        {required && <span className="text-danger"> *</span>}
      </legend>
      {children}
      <Notes {...state} hint={hint} />
    </fieldset>
  );
}

function Chip({
  type,
  name,
  checked,
  onChange,
  children,
}: {
  type: "radio" | "checkbox";
  name?: string;
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
}) {
  return (
    <label className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-background px-3 text-sm has-checked:border-brand has-checked:bg-brand-soft has-checked:text-brand">
      <input type={type} name={name} checked={checked} onChange={onChange} className="accent-brand" />
      {children}
    </label>
  );
}

function RangeInputs({
  min,
  max,
  onMin,
  onMax,
  unit,
  step,
  className,
}: {
  min?: number;
  max?: number;
  onMin: (v?: number) => void;
  onMax: (v?: number) => void;
  unit: string;
  step: string;
  className: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step={step}
        aria-label="最低"
        value={min ?? ""}
        onChange={(e) => onMin(numberOrUndefined(e.target.value))}
        className={`h-11 ${className}`}
      />
      <span aria-hidden="true">–</span>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step={step}
        aria-label="最高（可不填）"
        value={max ?? ""}
        onChange={(e) => onMax(numberOrUndefined(e.target.value))}
        placeholder="可不填"
        className={`h-11 ${className}`}
      />
      <span className="shrink-0 text-sm text-muted">{unit}</span>
    </div>
  );
}
