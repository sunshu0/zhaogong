"use client";
import { EMPLOYMENT_TYPE_LABELS, INDUSTRY_LABELS } from "@/i18n/labels";
import type { RequiredField } from "@/lib/ai-post";
import { wageFromDate, type Finding } from "@/lib/compliance";
import type { CountryCode, EmploymentType, Industry, VisaAccepted } from "@/lib/types";
import type { PostForm } from "@/components/employer/post-form";
import { normalizeEmploymentTypes } from "@/lib/employment-types";
import {
  Chip,
  Field,
  fieldKit,
  Group,
  RangeInputs,
  Section,
  toggle,
  type FieldKit,
} from "@/components/employer/DraftFormParts";
import { ContactSection, DescriptionSection, RequirementsSection } from "@/components/employer/DraftFormSections";
import { selectTone } from "@/components/employer/field-tone";
import { JobRolesField } from "@/components/employer/JobRolesField";
import { PayReferenceHint } from "@/components/employer/PayReferenceHint";
import { Select } from "@/components/ui/Select";
import { useLang, useMessages } from "@/i18n/client";
import { formatAmount } from "@/i18n/format";
import { employerPostMessages } from "@/i18n/messages/employer-post";

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
  const lang = useLang();
  const t = useMessages(employerPostMessages).form;
  const { form, set, state, box, aria } = kit;
  return (
    <Section title={t.jobSection}>
      <Field name="titleZh" label={t.titleZh} required {...state("titleZh")}>
        <input
          id="in-titleZh"
          {...aria("titleZh")}
          value={form.titleZh}
          onChange={(e) => set({ titleZh: e.target.value })}
          placeholder={t.titleZhPlaceholder}
          className={box("titleZh")}
        />
      </Field>
      <Field name="titleEn" label={t.titleEn} required {...state("titleEn")}>
        <input
          id="in-titleEn"
          {...aria("titleEn")}
          lang="en"
          value={form.titleEn}
          onChange={(e) => set({ titleEn: e.target.value })}
          placeholder={t.titleEnPlaceholder}
          className={box("titleEn")}
        />
      </Field>
      <Field name="industry" label={t.industry} required {...state("industry")}>
        <Select
          id="in-industry"
          aria-describedby={aria("industry")["aria-describedby"]}
          label={t.industry}
          hideLabel
          placeholder={t.chooseOne}
          options={Object.entries(INDUSTRY_LABELS).map(([value, l]) => ({ value, label: l[lang] }))}
          value={form.industry ?? ""}
          onChange={(value) => set({ industry: (value || undefined) as Industry | undefined })}
          tone={selectTone(state("industry"))}
        />
      </Field>
      <JobRolesField form={form} set={set} />
      <EmploymentTypeGroup kit={kit} />
      <Chip type="checkbox" checked={form.urgent} onChange={() => set({ urgent: !form.urgent })}>
        {t.urgent}
      </Chip>
    </Section>
  );
}

/** 全职 / 兼职 / 临时工: a job can be more than one. */
function EmploymentTypeGroup({ kit }: { kit: FieldKit }) {
  const lang = useLang();
  const t = useMessages(employerPostMessages).form;
  const { form, set, state, aria } = kit;
  const chosenTypes = form.employmentType ?? [];
  return (
    <Group name="employmentType" legend={t.employmentType} required {...state("employmentType")}>
      <div className="flex flex-wrap gap-2">
        {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, l]) => (
          <Chip
            key={value}
            type="checkbox"
            name="employmentType"
            aria={aria("employmentType")}
            checked={chosenTypes.includes(value as EmploymentType)}
            onChange={() =>
              set({ employmentType: normalizeEmploymentTypes(toggle(chosenTypes, value as EmploymentType)) })
            }
          >
            {l[lang]}
          </Chip>
        ))}
      </div>
    </Group>
  );
}

function PlaceSection({ kit }: { kit: FieldKit }) {
  const lang = useLang();
  const t = useMessages(employerPostMessages).form;
  const { form, set, state, box, aria, config } = kit;
  return (
    <Section title={t.placeSection}>
      <Field name="regionId" label={t.region} required {...state("regionId")}>
        <Select
          id="in-regionId"
          aria-describedby={aria("regionId")["aria-describedby"]}
          label={t.region}
          hideLabel
          placeholder={t.chooseOne}
          options={config.regions.map((r) => ({ value: r.id, label: lang === "en" ? r.nameEn : r.nameZh }))}
          value={form.regionId ?? ""}
          onChange={(regionId) => set({ regionId: regionId || undefined })}
          tone={selectTone(state("regionId"))}
        />
      </Field>
      <Field name="address" label={t.address} {...state("address")}>
        <input
          id="in-address"
          {...aria("address")}
          value={form.address}
          onChange={(e) => set({ address: e.target.value })}
          className={box("address")}
        />
      </Field>
      <Group name="hoursPerWeek" legend={t.hoursPerWeek} {...state("hoursPerWeek")}>
        <RangeInputs
          min={form.hoursMin}
          max={form.hoursMax}
          onMin={(v) => set({ hoursMin: v })}
          onMax={(v) => set({ hoursMax: v })}
          unit={t.hoursUnit}
          step="1"
          className={box("hoursPerWeek")}
          aria={aria("hoursPerWeek")}
        />
      </Group>
      <Field name="shiftsZh" label={t.shifts} {...state("shiftsZh")}>
        <input
          id="in-shiftsZh"
          {...aria("shiftsZh")}
          value={form.shiftsZh}
          onChange={(e) => set({ shiftsZh: e.target.value })}
          placeholder={t.shiftsPlaceholder}
          className={box("shiftsZh")}
        />
      </Field>
    </Section>
  );
}

function PaySection({ kit }: { kit: FieldKit }) {
  const lang = useLang();
  const t = useMessages(employerPostMessages).form;
  const { form, set, state, box, aria, config } = kit;
  const wage = config.minimumWage;
  const hint = t.payHint(
    lang === "en" ? config.nameEn : config.nameZh,
    `${config.currencySymbol}${formatAmount(wage.hourly, lang)}`,
    wageFromDate(wage.effectiveFrom, lang),
  );
  return (
    <Section title={t.paySection}>
      <Group name="pay" legend={t.pay} required hint={hint} {...state("pay")}>
        <RangeInputs
          min={form.payMin}
          max={form.payMax}
          onMin={(v) => set({ payMin: v })}
          onMax={(v) => set({ payMax: v })}
          unit={t.payUnit(config.currencySymbol)}
          step="0.01"
          className={box("pay")}
          aria={aria("pay")}
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
          {t.meals}
        </Chip>
        <Chip
          type="checkbox"
          checked={form.accommodationIncluded}
          onChange={() => set({ accommodationIncluded: !form.accommodationIncluded })}
        >
          {t.accommodation}
        </Chip>
      </div>
    </Section>
  );
}
