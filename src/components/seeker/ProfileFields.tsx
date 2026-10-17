"use client";

import { useId } from "react";
import type { Profile } from "@/components/seeker/hub-state";
import { inputClass } from "@/components/ui/input-class";

export type UpdateProfileField = <K extends keyof Profile>(field: K, value: Profile[K]) => boolean | undefined;
type PrivateDetails = NonNullable<Profile["privateDetails"]>;

const PRIVATE_FIELDS = [
  ["phone", "交换用电话", ""],
  ["wechat", "交换用微信", ""],
  ["email", "交换用邮箱", ""],
] as const;
const NO_PRIVATE_DETAILS: PrivateDetails = { phone: "", wechat: "", email: "" };

type FieldsProps = { profile: Profile; update: UpdateProfileField };

/** A job seeker's required text fields; 期望时薪 and 经验 come from ResumeKeyFields. */
export function SeekerRequiredFields({ profile, update }: FieldsProps) {
  return (
    <>
      <Field label="称呼" value={profile.name} onChange={(v) => update("name", v)} placeholder="例如：林晓" />
      <Field
        label="可上班时间"
        value={profile.availability}
        onChange={(v) => update("availability", v)}
        placeholder="例如：周一至周六，下午可上班"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="地区"
          value={profile.location}
          onChange={(v) => update("location", v)}
          placeholder="例如：奥克兰 · 北岸"
        />
        <Field
          label="语言"
          value={profile.languages}
          onChange={(v) => update("languages", v)}
          placeholder="例如：普通话、英语"
        />
      </div>
    </>
  );
}

export function SeekerOptionalFields({ profile, update }: FieldsProps) {
  return (
    <>
      <Field
        label="一句话介绍"
        value={profile.headline}
        onChange={(v) => update("headline", v)}
        placeholder="例如：前厅服务 · 中英文沟通"
      />
      <TextArea
        label="个人介绍"
        value={profile.bio}
        onChange={(v) => update("bio", v)}
        placeholder="介绍你的经验、擅长的工作和期望…"
      />
    </>
  );
}

/** What job seekers look at first about a business; 企业验证 is a link beside these. */
export function EmployerRequiredFields({ profile, update }: FieldsProps) {
  return (
    <>
      <Field label="企业名称" value={profile.name} onChange={(v) => update("name", v)} placeholder="企业或店铺名称" />
      <TextArea
        label="企业介绍"
        value={profile.bio}
        onChange={(v) => update("bio", v)}
        placeholder="介绍企业、工作环境和团队…"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="地区"
          value={profile.location}
          onChange={(v) => update("location", v)}
          placeholder="例如：Mt Eden · Dominion Rd"
        />
        <Field
          label="招聘联系人"
          value={profile.contactName}
          onChange={(v) => update("contactName", v)}
          placeholder="例如：陈经理"
        />
      </div>
    </>
  );
}

export function EmployerOptionalFields({ profile, update }: FieldsProps) {
  return (
    <>
      <Field
        label="招聘简介"
        value={profile.headline}
        onChange={(v) => update("headline", v)}
        placeholder="例如：前厅、后厨招聘"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="语言"
          value={profile.languages}
          onChange={(v) => update("languages", v)}
          placeholder="例如：普通话、英语"
        />
        <Field
          label="联系时间"
          value={profile.availability}
          onChange={(v) => update("availability", v)}
          placeholder="例如：工作日 10:00–17:00"
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
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {PRIVATE_FIELDS.map(([key, label, placeholder]) => (
        <Field
          key={key}
          label={label}
          value={details?.[key] ?? ""}
          placeholder={placeholder}
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
