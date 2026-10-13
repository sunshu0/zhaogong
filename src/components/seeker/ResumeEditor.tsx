"use client";

import { COUNTRIES } from "@/config/countries";
import { EMPLOYMENT_TYPE_LABELS } from "@/i18n/labels";
import { EMPTY_RESUME, type Resume } from "@/lib/candidate-matching";
import type { EmploymentType } from "@/lib/types";

const toggle = <T,>(values: T[], value: T) => values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
const numberOrEmpty = (value: string) => value === "" ? undefined : Number(value);
const inputClass = "h-11 w-full rounded-lg border border-border bg-background px-3 focus:border-brand";

export function ResumeEditor({ value = EMPTY_RESUME, onChange }: { value?: Resume; onChange: (value: Resume) => void }) {
  function update(patch: Partial<Resume>) {
    onChange({ ...value, ...patch, candidateId: value.candidateId ?? crypto.randomUUID() });
  }
  return (
    <section className="space-y-4 border-t border-border pt-5" aria-labelledby="resume-heading">
      <h2 id="resume-heading" className="font-semibold">求职意向与简历</h2>
      <label className="block text-sm"><span className="mb-1 block font-medium">工作技能</span><input value={value.skills} onChange={(event) => update({ skills: event.target.value })} placeholder="例如：点餐、上菜、收银" className={inputClass} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm"><span className="mb-1 block font-medium">相关岗位经验（年）</span><input type="number" min="0" max="60" step="0.5" value={value.experienceYears ?? ""} onChange={(event) => update({ experienceYears: numberOrEmpty(event.target.value) })} className={inputClass} /></label>
        <label className="block text-sm"><span className="mb-1 block font-medium">期望最低时薪（NZ$）</span><input type="number" min="0" max="200" step="0.5" value={value.expectedMinPay ?? ""} onChange={(event) => update({ expectedMinPay: numberOrEmpty(event.target.value) })} className={inputClass} /></label>
      </div>
      <fieldset><legend className="mb-2 text-sm font-medium">期望用工形式</legend><div className="flex flex-wrap gap-2">{(Object.entries(EMPLOYMENT_TYPE_LABELS) as [EmploymentType, { zh: string }][]).map(([type, label]) => <label key={type} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${value.employmentTypes.includes(type) ? "border-brand bg-brand-soft text-brand" : "border-border"}`}><input type="checkbox" className="size-4 accent-brand" checked={value.employmentTypes.includes(type)} onChange={() => update({ employmentTypes: toggle(value.employmentTypes, type) })} />{label.zh}</label>)}</div></fieldset>
      <fieldset><legend className="mb-2 text-sm font-medium">每周可工作工时</legend><div className="grid grid-cols-2 gap-3">{(["min", "max"] as const).map((key) => <label key={key} className="text-sm"><span className="mb-1 block text-muted">{key === "min" ? "最少小时" : "最多小时"}</span><input type="number" min="1" max="80" value={value.hoursPerWeek?.[key] ?? ""} onChange={(event) => {
        const next = numberOrEmpty(event.target.value);
        const other = value.hoursPerWeek?.[key === "min" ? "max" : "min"] ?? next;
        update({ hoursPerWeek: next === undefined || other === undefined ? undefined : key === "min" ? { min: next, max: Math.max(next, other) } : { min: Math.min(next, other), max: next } });
      }} className={inputClass} /></label>)}</div></fieldset>
      <fieldset><legend className="mb-2 text-sm font-medium">可工作地区</legend><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{COUNTRIES.NZ.regions.map((region) => <label key={region.id} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"><input type="checkbox" className="size-4 shrink-0 accent-brand" checked={value.regionIds.includes(region.id)} onChange={() => update({ regionIds: toggle(value.regionIds, region.id) })} />{region.nameZh}</label>)}</div></fieldset>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 border-t border-border pt-4 text-sm font-medium"><input type="checkbox" className="size-4 shrink-0 accent-brand" checked={value.discoverable} onChange={(event) => update({ discoverable: event.target.checked })} />允许向雇主推荐我的求职主页</label>
    </section>
  );
}
