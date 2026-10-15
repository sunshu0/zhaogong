"use client";

import type { Profile } from "@/components/seeker/hub-state";

export type UpdateProfileField = <K extends keyof Profile>(field: K, value: Profile[K]) => boolean | undefined;
type PrivateDetails = NonNullable<Profile["privateDetails"]>;

const PRIVATE_FIELDS = [
  ["phone", "交换用电话", ""],
  ["wechat", "交换用微信", ""],
  ["email", "交换用邮箱", ""],
] as const;
const NO_PRIVATE_DETAILS: PrivateDetails = { phone: "", wechat: "", email: "" };

export function ProfileBasics({
  profile,
  isEmployer,
  update,
}: {
  profile: Profile;
  isEmployer: boolean;
  update: UpdateProfileField;
}) {
  return (
    <section className="space-y-4" aria-labelledby="profile-basic">
      <h2 id="profile-basic" className="font-medium">
        {isEmployer ? "企业资料" : "基本资料"}
      </h2>
      <Field
        label={isEmployer ? "企业名称" : "称呼"}
        value={profile.name}
        onChange={(value) => update("name", value)}
        placeholder={isEmployer ? "企业或店铺名称" : "例如：林晓"}
      />
      {isEmployer && (
        <Field
          label="招聘联系人"
          value={profile.contactName}
          onChange={(value) => update("contactName", value)}
          placeholder="例如：陈经理"
        />
      )}
      <Field
        label={isEmployer ? "招聘简介" : "一句话介绍"}
        value={profile.headline}
        onChange={(value) => update("headline", value)}
        placeholder={isEmployer ? "例如：前厅、后厨招聘" : "例如：前厅服务 · 中英文沟通"}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={isEmployer ? "工作地址" : "所在地区"}
          value={profile.location}
          onChange={(value) => update("location", value)}
          placeholder={isEmployer ? "店铺地址" : "例如：奥克兰 · 北岸"}
        />
        <Field
          label="语言"
          value={profile.languages}
          onChange={(value) => update("languages", value)}
          placeholder="例如：普通话、英语"
        />
      </div>
      <Field
        label={isEmployer ? "联系时间" : "可工作时间"}
        value={profile.availability}
        onChange={(value) => update("availability", value)}
        placeholder={isEmployer ? "例如：工作日 10:00–17:00" : "例如：周一至周六，下午可上班"}
      />
      <div className="text-sm">
        <label htmlFor="profile-bio" className="mb-1 block font-medium">
          {isEmployer ? "企业介绍" : "个人介绍"}
        </label>
        <textarea
          id="profile-bio"
          value={profile.bio}
          onChange={(event) => update("bio", event.target.value)}
          rows={4}
          placeholder={isEmployer ? "介绍企业、工作环境和团队…" : "介绍你的经验、擅长的工作和期望…"}
          className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </div>
    </section>
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
    <section className="space-y-4 border-t border-border pt-4" aria-labelledby="profile-private">
      <h2 id="profile-private" className="font-semibold">
        私密交换资料
      </h2>
      <p className="text-xs text-muted">
        只在聊天里交换时给对方：你发起交换时对方马上能看到；对方发起时，你同意后才给。不显示在公开主页。
      </p>
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
    </section>
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
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-lg border border-border bg-background px-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
    </label>
  );
}
