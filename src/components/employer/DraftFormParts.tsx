"use client";
// Building blocks of the job form (DraftForm): sections, labelled fields and groups with their
// notes, choice chips and min–max inputs, plus FieldKit, what every section needs to draw a field.
import type { ReactNode } from "react";
import { COUNTRIES, type CountryConfig } from "@/config/countries";
import type { RequiredField } from "@/lib/ai-post";
import type { Finding, JobDraft } from "@/lib/compliance";
import type { CountryCode, VisaAccepted } from "@/lib/types";
import { FindingItem } from "@/components/employer/FindingsPanel";
import type { PostForm } from "@/components/employer/post-form";

export type FieldState = { missing: boolean; findings: Finding[] };

/** The form, how to change it, and each field's state and box style. */
export type FieldKit = {
  form: PostForm;
  set: (patch: Partial<PostForm>) => void;
  config: CountryConfig;
  state: (field: keyof JobDraft) => FieldState;
  box: (field: keyof JobDraft) => string;
  visaChoices: VisaAccepted[];
};

export function fieldKit({
  form,
  set,
  findings,
  missing,
  country,
  visaChoices,
}: {
  form: PostForm;
  set: (patch: Partial<PostForm>) => void;
  findings: Finding[];
  missing: RequiredField[];
  country: CountryCode;
  visaChoices: VisaAccepted[];
}): FieldKit {
  const state = (field: keyof JobDraft): FieldState => ({
    missing: (missing as (keyof JobDraft)[]).includes(field),
    findings: findings.filter((f) => f.field === field),
  });
  const box = (field: keyof JobDraft) => `w-full rounded-lg border bg-background px-3 ${fieldTone(state(field))}`;
  return { form, set, config: COUNTRIES[country], state, box, visaChoices };
}

/** Red for a problem that holds publishing, amber for a field the parser could not fill, else plain. */
function fieldTone({ findings, missing }: FieldState): string {
  if (findings.some((f) => f.level !== "review")) return "border-danger";
  if (missing) return "border-warn bg-warn-soft/40";
  return "border-border";
}

export const toggle = <T,>(list: T[], value: T) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

const numberOrUndefined = (value: string) => (value === "" ? undefined : Number(value));

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl border border-border bg-surface p-4">
      <h2 className="font-medium">{title}</h2>
      {children}
    </section>
  );
}

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

type LabelledProps = FieldState & { name: string; required?: boolean; hint?: string; children: ReactNode };

/** One control with its label: id `field-<name>` for the findings links, the control's id `in-<name>`. */
export function Field({ name, label, required, hint, children, ...state }: LabelledProps & { label: string }) {
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

/** Several controls under one legend (checkboxes, a min–max pair). */
export function Group({ name, legend, required, hint, children, ...state }: LabelledProps & { legend: string }) {
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

export function Chip({
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

export function RangeInputs({
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
