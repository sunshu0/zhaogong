"use client";
// The last three sections of the job form (DraftForm): requirements, description, contact.
import { LANGUAGE_LABELS, VISA_LABELS } from "@/i18n/labels";
import type { LanguageRequirement, VisaAccepted } from "@/lib/types";
import { Chip, Field, Group, Section, toggle, type FieldKit } from "@/components/employer/DraftFormParts";

/** The three ways to be contacted: form key, label, input type, placeholder. */
const CONTACT_FIELDS = [
  ["phone", "电话", "tel", "021 123 4567"],
  ["wechat", "微信号", "text", ""],
  ["email", "邮箱", "email", "name@example.com"],
] as const;

export function RequirementsSection({ kit }: { kit: FieldKit }) {
  const { form, set, state, config } = kit;
  return (
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
  );
}

export function DescriptionSection({ kit, onRegenerateEn }: { kit: FieldKit; onRegenerateEn: () => void }) {
  const { form, set, state, box } = kit;
  return (
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
  );
}

export function ContactSection({ kit }: { kit: FieldKit }) {
  const { form, set, state, box } = kit;
  return (
    <Section title="联系方式">
      <Group name="contact" legend="至少填一种" required hint="只有登录的求职者才能看到。" {...state("contact")}>
        <div className="space-y-2">
          {CONTACT_FIELDS.map(([key, label, type, placeholder]) => (
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
  );
}
