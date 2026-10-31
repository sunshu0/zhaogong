"use client";
// The last three sections of the job form (DraftForm): requirements, description, contact.
import Link from "next/link";
import { LANGUAGE_LABELS, VISA_LABELS } from "@/i18n/labels";
import type { LanguageRequirement, VisaAccepted } from "@/lib/types";
import { Chip, Field, Group, Section, toggle, type FieldKit } from "@/components/employer/DraftFormParts";
import { CHOICE_DOT } from "@/components/employer/app-style";
import { useLang, useMessages } from "@/i18n/client";
import { employerPostMessages } from "@/i18n/messages/employer-post";

export function RequirementsSection({ kit }: { kit: FieldKit }) {
  const lang = useLang();
  const t = useMessages(employerPostMessages).form;
  const { form, set, state, aria, visaChoices } = kit;
  return (
    <Section title={t.requirementsSection}>
      <Group name="visaAccepted" legend={t.visaAccepted} required hint={t.visaHint} {...state("visaAccepted")}>
        <div className="flex flex-wrap gap-2">
          {visaChoices.map((visa) => (
            <Chip
              key={visa}
              type="checkbox"
              aria={aria("visaAccepted")}
              checked={form.visaAccepted.includes(visa)}
              onChange={() => set({ visaAccepted: toggle<VisaAccepted>(form.visaAccepted, visa) })}
            >
              {VISA_LABELS[visa][lang]}
            </Chip>
          ))}
        </div>
      </Group>
      <Group name="languages" legend={t.languages} {...state("languages")}>
        <div className="flex flex-wrap gap-2">
          {Object.entries(LANGUAGE_LABELS).map(([value, l]) => (
            <Chip
              key={value}
              type="checkbox"
              aria={aria("languages")}
              checked={form.languages.includes(value as LanguageRequirement)}
              onChange={() => set({ languages: toggle(form.languages, value as LanguageRequirement) })}
            >
              {l[lang]}
            </Chip>
          ))}
        </div>
      </Group>
    </Section>
  );
}

export function DescriptionSection({ kit, onRegenerateEn }: { kit: FieldKit; onRegenerateEn: () => void }) {
  const t = useMessages(employerPostMessages).form;
  const { form, set, state, box, aria } = kit;
  return (
    <Section title={t.descriptionSection}>
      <Field name="descriptionZh" label={t.descriptionZh} required {...state("descriptionZh")}>
        <textarea
          id="in-descriptionZh"
          {...aria("descriptionZh")}
          lang="zh-CN"
          rows={5}
          value={form.descriptionZh}
          onChange={(e) => set({ descriptionZh: e.target.value })}
          className={box("descriptionZh", true)}
        />
      </Field>
      <Field
        name="descriptionEn"
        label={t.descriptionEn}
        required
        hint={t.descriptionEnHint}
        {...state("descriptionEn")}
      >
        <textarea
          id="in-descriptionEn"
          {...aria("descriptionEn")}
          lang="en"
          rows={4}
          value={form.descriptionEn}
          onChange={(e) => set({ descriptionEn: e.target.value })}
          className={box("descriptionEn", true)}
        />
        <button
          type="button"
          onClick={onRegenerateEn}
          className="pressable inline-flex min-h-11 items-center text-body text-brand underline"
        >
          {t.regenerateEn}
        </button>
      </Field>
    </Section>
  );
}

export function ContactSection({ kit }: { kit: FieldKit }) {
  const lang = useLang();
  const t = useMessages(employerPostMessages).form;
  const { form, set, state, box, aria } = kit;
  // 电话 / 微信号 / 邮箱 fit in three characters; "WeChat ID" needs more room before the input.
  const labelWidth = lang === "en" ? "w-20" : "w-12";
  // The employer's choice first: private (the default, swapped in chat) or shown to signed-in job seekers.
  const contactChoices = [
    [false, t.contactPrivateChoice, t.contactPrivateNote],
    [true, t.contactPublicChoice, t.contactPublicNote],
  ] as const;
  // The three ways to be contacted: form key, label, input type, placeholder.
  const contactFields = [
    { key: "phone", label: t.contactPhone, type: "tel", placeholder: t.contactPhonePlaceholder, autoComplete: "tel" },
    { key: "wechat", label: t.contactWechat, type: "text", placeholder: "", autoComplete: "off" },
    {
      key: "email",
      label: t.contactEmail,
      type: "email",
      placeholder: t.contactEmailPlaceholder,
      autoComplete: "email",
    },
  ] as const;
  return (
    <Section title={t.contactSection}>
      <fieldset id="field-contactPublic" className="space-y-2">
        <legend className="mb-1.5 text-body font-medium">{t.contactChoiceLegend}</legend>
        {contactChoices.map(([value, label, note]) => (
          <label
            key={label}
            className="pressable-row flex cursor-pointer items-start gap-3 rounded-control bg-background p-3 has-checked:bg-brand-soft"
          >
            <input
              type="radio"
              name="contactPublic"
              checked={form.contactPublic === value}
              onChange={() => set({ contactPublic: value })}
              className={`mt-0.5 ${CHOICE_DOT}`}
            />
            <span>
              <span className="block text-body">{label}</span>
              <span className="block text-meta text-muted">{note}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {form.contactPublic ? (
        <Group name="contact" legend={t.contactLegend} required hint={t.contactHint} {...state("contact")}>
          <div className="space-y-2">
            {contactFields.map(({ key, label, type, placeholder, autoComplete }) => (
              <label key={key} className="flex items-center gap-2">
                <span className={`${labelWidth} shrink-0 text-body`}>{label}</span>
                <input
                  type={type}
                  name={`contact-${key}`}
                  autoComplete={autoComplete}
                  // UI audit 1 B: a WeChat ID or an address is not a word to correct or capitalise.
                  spellCheck={false}
                  autoCapitalize={key === "phone" ? undefined : "none"}
                  autoCorrect={key === "phone" ? undefined : "off"}
                  value={form[key]}
                  onChange={(e) => set({ [key]: e.target.value })}
                  placeholder={placeholder}
                  className={box("contact")}
                  {...aria("contact")}
                />
              </label>
            ))}
          </div>
        </Group>
      ) : (
        <p className="text-body text-muted">
          {t.contactPrivateBefore}
          <Link href="/profile" className="text-brand underline underline-offset-2">
            {t.contactPrivateLink}
          </Link>
          {t.contactPrivateAfter}
        </p>
      )}
    </Section>
  );
}
