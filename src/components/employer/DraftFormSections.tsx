"use client";
// The last three sections of the job form (DraftForm): requirements, description, contact.
import Link from "next/link";
import { LANGUAGE_LABELS, VISA_LABELS } from "@/i18n/labels";
import type { LanguageRequirement, VisaAccepted } from "@/lib/types";
import { Chip, Field, Group, Section, toggle, type FieldKit } from "@/components/employer/DraftFormParts";

/** The three ways to be contacted: form key, label, input type, placeholder. */
const CONTACT_FIELDS = [
  ["phone", "电话", "tel", "021 xxx xxxx"],
  ["wechat", "微信号", "text", ""],
  ["email", "邮箱", "email", "name@example.com"],
] as const;

export function RequirementsSection({ kit }: { kit: FieldKit }) {
  const { form, set, state, visaChoices } = kit;
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
          {visaChoices.map((visa) => (
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
        <button type="button" onClick={onRegenerateEn} className="text-body text-brand underline">
          按表格重新生成
        </button>
      </Field>
    </Section>
  );
}

/** The employer's choice first: private (the default, swapped in chat) or shown to signed-in job seekers. */
const CONTACT_CHOICES = [
  [false, "不公开，求职者在聊天中申请交换", "你同意后，双方才交换联系方式。"],
  [true, "公开给登录的求职者", "登录的求职者在职位页直接看到。"],
] as const;

export function ContactSection({ kit }: { kit: FieldKit }) {
  const { form, set, state, box } = kit;
  return (
    <Section title="联系方式">
      <fieldset id="field-contactPublic" className="scroll-mt-20 space-y-2">
        <legend className="mb-1.5 text-body font-medium">求职者怎么联系你</legend>
        {CONTACT_CHOICES.map(([value, label, note]) => (
          <label
            key={label}
            className="flex cursor-pointer items-start gap-2 rounded-md border border-border p-3 has-checked:border-brand has-checked:bg-brand-soft"
          >
            <input
              type="radio"
              name="contactPublic"
              checked={form.contactPublic === value}
              onChange={() => set({ contactPublic: value })}
              className="mt-1 accent-brand"
            />
            <span>
              <span className="block text-body">{label}</span>
              <span className="block text-meta text-muted">{note}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {form.contactPublic ? (
        <Group name="contact" legend="至少填一种" required hint="只有登录的求职者才能看到。" {...state("contact")}>
          <div className="space-y-2">
            {CONTACT_FIELDS.map(([key, label, type, placeholder]) => (
              <label key={key} className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-body">{label}</span>
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
      ) : (
        <p className="text-body text-muted">
          不用在这里填写。交换时给求职者的资料，请在
          <Link href="/profile" className="text-brand underline underline-offset-2">
            企业主页
          </Link>
          的「私密交换资料」里填好。
        </p>
      )}
    </Section>
  );
}
