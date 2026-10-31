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
import { ChoicePill } from "@/components/employer/ChoicePill";
import { fieldTone, type FieldState } from "@/components/employer/field-tone";
import { useLang, useMessages } from "@/i18n/client";
import { employerPostMessages } from "@/i18n/messages/employer-post";

export type { FieldState };

/** The form, how to change it, and each field's state, box style and what a control tells screen readers. */
export type FieldKit = {
  form: PostForm;
  set: (patch: Partial<PostForm>) => void;
  config: CountryConfig;
  state: (field: keyof JobDraft) => FieldState;
  box: (field: keyof JobDraft) => string;
  aria: (field: keyof JobDraft) => FieldAria;
  visaChoices: VisaAccepted[];
};

/** A control's link to its notes below it, and whether it holds the form back (UI audit 1 #11). */
export type FieldAria = { "aria-describedby"?: string; "aria-invalid"?: true };

/** The id of a field's notes (不能发布：…, 没有识别到…), there while it has any. */
export const noteId = (name: string) => `note-${name}`;

const hasNotes = ({ missing, findings }: FieldState) => missing || findings.length > 0;

/** Describes the control by its notes; invalid while it is missing or has a finding that must be fixed. */
export function fieldAria(name: string, state: FieldState): FieldAria {
  if (!hasNotes(state)) return {};
  const invalid = state.missing || state.findings.some((f) => f.level !== "review");
  return { "aria-describedby": noteId(name), ...(invalid ? { "aria-invalid": true } : {}) };
}

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
  const box = (field: keyof JobDraft) => `w-full rounded-control border bg-background px-3 ${fieldTone(state(field))}`;
  const aria = (field: keyof JobDraft) => fieldAria(field, state(field));
  return { form, set, config: COUNTRIES[country], state, box, aria, visaChoices };
}

export const toggle = <T,>(list: T[], value: T) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

const numberOrUndefined = (value: string) => (value === "" ? undefined : Number(value));

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-card bg-surface p-4 ring-1 ring-border lg:p-5">
      <h2 className="text-subtitle font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Notes({ name, missing, findings, hint }: FieldState & { name: string; hint?: string }) {
  const lang = useLang();
  const t = useMessages(employerPostMessages).form;
  return (
    <>
      {/* One element with an id, so the control can be described by it (fieldAria). */}
      {hasNotes({ missing, findings }) && (
        <div id={noteId(name)} className="space-y-1.5">
          {missing && <p className="text-meta text-warn">{t.notRecognised}</p>}
          {findings.map((f, i) => (
            <FindingItem key={i} finding={f} lang={lang} />
          ))}
        </div>
      )}
      {hint && <p className="text-meta text-muted">{hint}</p>}
    </>
  );
}

type LabelledProps = FieldState & { name: string; required?: boolean; hint?: string; children: ReactNode };

/** One control with its label: id `field-<name>` for the findings links, the control's id `in-<name>`. */
export function Field({ name, label, required, hint, children, ...state }: LabelledProps & { label: string }) {
  return (
    <div id={`field-${name}`} className="scroll-mt-20 space-y-1.5">
      <label htmlFor={`in-${name}`} className="block text-body font-medium">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {children}
      <Notes name={name} {...state} hint={hint} />
    </div>
  );
}

/** Several controls under one legend (checkboxes, a min–max pair). */
export function Group({ name, legend, required, hint, children, ...state }: LabelledProps & { legend: string }) {
  return (
    <fieldset
      id={`field-${name}`}
      aria-describedby={fieldAria(name, state)["aria-describedby"]}
      className="scroll-mt-20 space-y-1.5"
    >
      <legend className="mb-1.5 text-body font-medium">
        {legend}
        {required && <span className="text-danger"> *</span>}
      </legend>
      {children}
      <Notes name={name} {...state} hint={hint} />
    </fieldset>
  );
}

/** A choice chip of the form: the Round 19 pill (ChoicePill). */
export const Chip = ChoicePill;

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
  const t = useMessages(employerPostMessages).form;
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step={step}
        aria-label={t.rangeMin}
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
        aria-label={t.rangeMax}
        value={max ?? ""}
        onChange={(e) => onMax(numberOrUndefined(e.target.value))}
        placeholder={t.rangeMaxPlaceholder}
        className={`h-11 ${className}`}
      />
      <span className="shrink-0 text-body text-muted">{unit}</span>
    </div>
  );
}
