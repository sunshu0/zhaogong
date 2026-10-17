"use client";
import { EMPLOYMENT_TYPE_LABELS, INDUSTRY_LABELS } from "@/i18n/labels";
import type { RequiredField } from "@/lib/ai-post";
import type { Finding } from "@/lib/compliance";
import type { CountryCode, EmploymentType, Industry, VisaAccepted } from "@/lib/types";
import type { PostForm } from "@/components/employer/post-form";
import { normalizeEmploymentTypes } from "@/lib/employment-types";
import {
  Chip,
  Field,
  fieldKit,
  selectTone,
  Group,
  RangeInputs,
  Section,
  toggle,
  type FieldKit,
} from "@/components/employer/DraftFormParts";
import { ContactSection, DescriptionSection, RequirementsSection } from "@/components/employer/DraftFormSections";
import { JobRolesField } from "@/components/employer/JobRolesField";
import { PayReferenceHint } from "@/components/employer/PayReferenceHint";
import { Select } from "@/components/ui/Select";

type Props = {
  form: PostForm;
  set: (patch: Partial<PostForm>) => void;
  findings: Finding[];
  missing: RequiredField[];
  country: CountryCode;
  /** The visas this employer may offer (AEWV holders only for accredited employers). */
  visaChoices: VisaAccepted[];
  onRegenerateEn: () => void;
};

/** The job form, one section per topic; each field shows what the parser missed and what the checks found. */
export function DraftForm({ form, set, findings, missing, country, visaChoices, onRegenerateEn }: Props) {
  const kit = fieldKit({ form, set, findings, missing, country, visaChoices });
  return (
    <div className="space-y-6">
      <JobSection kit={kit} />
      <PlaceSection kit={kit} />
      <PaySection kit={kit} />
      <RequirementsSection kit={kit} />
      <DescriptionSection kit={kit} onRegenerateEn={onRegenerateEn} />
      <ContactSection kit={kit} />
    </div>
  );
}

function JobSection({ kit }: { kit: FieldKit }) {
  const { form, set, state, box } = kit;
  return (
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
        <Select
          id="in-industry"
          label="行业"
          hideLabel
          placeholder="请选择"
          options={Object.entries(INDUSTRY_LABELS).map(([value, l]) => ({ value, label: l.zh }))}
          value={form.industry ?? ""}
          onChange={(value) => set({ industry: (value || undefined) as Industry | undefined })}
          tone={selectTone(state("industry"))}
        />
      </Field>
      <JobRolesField form={form} set={set} />
      <EmploymentTypeGroup kit={kit} />
      <Chip type="checkbox" checked={form.urgent} onChange={() => set({ urgent: !form.urgent })}>
        急招
      </Chip>
    </Section>
  );
}

/** 全职 / 兼职 / 临时工: a job can be more than one. */
function EmploymentTypeGroup({ kit }: { kit: FieldKit }) {
  const { form, set, state } = kit;
  const chosenTypes = form.employmentType ?? [];
  return (
    <Group name="employmentType" legend="工作类型" required {...state("employmentType")}>
      <div className="flex flex-wrap gap-2">
        {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, l]) => (
          <Chip
            key={value}
            type="checkbox"
            name="employmentType"
            checked={chosenTypes.includes(value as EmploymentType)}
            onChange={() =>
              set({ employmentType: normalizeEmploymentTypes(toggle(chosenTypes, value as EmploymentType)) })
            }
          >
            {l.zh}
          </Chip>
        ))}
      </div>
    </Group>
  );
}

function PlaceSection({ kit }: { kit: FieldKit }) {
  const { form, set, state, box, config } = kit;
  return (
    <Section title="地点和时间">
      <Field name="regionId" label="地区" required {...state("regionId")}>
        <Select
          id="in-regionId"
          label="地区"
          hideLabel
          placeholder="请选择"
          options={config.regions.map((r) => ({ value: r.id, label: r.nameZh }))}
          value={form.regionId ?? ""}
          onChange={(regionId) => set({ regionId: regionId || undefined })}
          tone={selectTone(state("regionId"))}
        />
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
  );
}

function PaySection({ kit }: { kit: FieldKit }) {
  const { form, set, state, box, config } = kit;
  const wage = config.minimumWage;
  const hint = `${config.nameZh}最低工资 ${config.currencySymbol}${wage.hourly}/小时（${wage.effectiveFrom} 起）。只有一个数就只填左边。`;
  return (
    <Section title="工资和福利">
      <Group name="pay" legend="时薪" required hint={hint} {...state("pay")}>
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
      <PayReferenceHint
        country={config.code}
        industry={form.industry}
        regionId={form.regionId}
        pay={{ min: form.payMin, max: form.payMax }}
      />
      <div className="flex flex-wrap gap-2">
        <Chip type="checkbox" checked={form.mealsIncluded} onChange={() => set({ mealsIncluded: !form.mealsIncluded })}>
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
  );
}
