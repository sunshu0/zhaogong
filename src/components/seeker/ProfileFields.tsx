"use client";

import { useId } from "react";
import type { Profile } from "@/components/seeker/hub-state";
import { inputClass } from "@/components/ui/input-class";
import { useMessages } from "@/i18n/client";
import { seekerProfileMessages } from "@/i18n/messages/seeker-profile";

export type UpdateProfileField = <K extends keyof Profile>(field: K, value: Profile[K]) => boolean | undefined;
type PrivateDetails = NonNullable<Profile["privateDetails"]>;

/** The details for swapping; their labels are the fields' words of the same names (seeker-profile). */
const PRIVATE_FIELDS = ["phone", "wechat", "email"] as const;
const NO_PRIVATE_DETAILS: PrivateDetails = { phone: "", wechat: "", email: "" };

type FieldsProps = { profile: Profile; update: UpdateProfileField };

/** A job seeker's required text fields; 期望时薪 and 经验 come from ResumeKeyFields. */
export function SeekerRequiredFields({ profile, update }: FieldsProps) {
  const f = useMessages(seekerProfileMessages).fields;
  return (
    <>
      <Field label={f.name} value={profile.name} onChange={(v) => update("name", v)} placeholder={f.namePlaceholder} />
      <Field
        label={f.availability}
        value={profile.availability}
        onChange={(v) => update("availability", v)}
        placeholder={f.availabilityPlaceholder}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={f.region}
          value={profile.location}
          onChange={(v) => update("location", v)}
          placeholder={f.regionPlaceholder}
        />
        <Field
          label={f.languages}
          value={profile.languages}
          onChange={(v) => update("languages", v)}
          placeholder={f.languagesPlaceholder}
        />
      </div>
    </>
  );
}

export function SeekerOptionalFields({ profile, update }: FieldsProps) {
  const f = useMessages(seekerProfileMessages).fields;
  return (
    <>
      <Field
        label={f.headline}
        value={profile.headline}
        onChange={(v) => update("headline", v)}
        placeholder={f.headlinePlaceholder}
      />
      <TextArea label={f.bio} value={profile.bio} onChange={(v) => update("bio", v)} placeholder={f.bioPlaceholder} />
    </>
  );
}

/** What job seekers look at first about a business; 企业验证 is a link beside these. */
export function EmployerRequiredFields({ profile, update }: FieldsProps) {
  const f = useMessages(seekerProfileMessages).fields;
  return (
    <>
      <Field
        label={f.businessName}
        value={profile.name}
        onChange={(v) => update("name", v)}
        placeholder={f.businessNamePlaceholder}
      />
      <TextArea
        label={f.businessBio}
        value={profile.bio}
        onChange={(v) => update("bio", v)}
        placeholder={f.businessBioPlaceholder}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={f.region}
          value={profile.location}
          onChange={(v) => update("location", v)}
          placeholder={f.businessRegionPlaceholder}
        />
        <Field
          label={f.contactName}
          value={profile.contactName}
          onChange={(v) => update("contactName", v)}
          placeholder={f.contactNamePlaceholder}
        />
      </div>
    </>
  );
}

export function EmployerOptionalFields({ profile, update }: FieldsProps) {
  const f = useMessages(seekerProfileMessages).fields;
  return (
    <>
      <Field
        label={f.businessHeadline}
        value={profile.headline}
        onChange={(v) => update("headline", v)}
        placeholder={f.businessHeadlinePlaceholder}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={f.languages}
          value={profile.languages}
          onChange={(v) => update("languages", v)}
          placeholder={f.languagesPlaceholder}
        />
        <Field
          label={f.contactHours}
          value={profile.availability}
          onChange={(v) => update("availability", v)}
          placeholder={f.contactHoursPlaceholder}
        />
      </div>
    </>
  );
}

/** Contact details shared only through a mutual exchange in chat. */
export function PrivateDetailsFields({
  details,
  onChange,
}: {
  details?: PrivateDetails;
  onChange: (details: PrivateDetails) => void;
}) {
  const f = useMessages(seekerProfileMessages).fields;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {PRIVATE_FIELDS.map((key) => (
        <Field
          key={key}
          label={f[key]}
          value={details?.[key] ?? ""}
          placeholder=""
          onChange={(value) => onChange({ ...NO_PRIVATE_DETAILS, ...details, [key]: value })}
        />
      ))}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block text-body">
      <span className="mb-1 block font-medium">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={inputClass()}
      />
    </label>
  );
}

/**
 * Labelled with htmlFor, not by wrapping: a textarea's text is part of a wrapping label's text, so its accessible
 * name would grow with whatever was typed.
 */
function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const id = useId();
  return (
    <div className="text-body">
      <label htmlFor={id} className="mb-1 block font-medium">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        placeholder={placeholder}
        className={`resize-y ${inputClass({ multiline: true })}`}
      />
    </div>
  );
}
