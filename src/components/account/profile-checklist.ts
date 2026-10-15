// What a profile still lacks, for 资料完成度 on /profile (C4) and the workspace to-do list (C3).
// `key` items are what the other side looks at first: employers judge a job seeker by when they can work, where,
// for how much, which languages and how much experience; job seekers judge a business by its introduction, where it
// is, whether it is verified and whom they will talk to.
import type { Profile } from "@/components/seeker/hub-state";
import type { EmployerVerification } from "@/lib/types";

export type ChecklistItem = { id: string; label: string; done: boolean; key: boolean };

const filled = (value: string | undefined) => Boolean(value?.trim());

export function profileChecklist(
  profile: Profile,
  isEmployer: boolean,
  verification?: EmployerVerification,
): ChecklistItem[] {
  if (isEmployer) {
    return [
      { id: "bio", label: "企业介绍", done: filled(profile.bio), key: true },
      { id: "location", label: "地区", done: filled(profile.location), key: true },
      { id: "verification", label: "企业验证", done: !!verification && verification !== "unverified", key: true },
      { id: "contactName", label: "招聘联系人", done: filled(profile.contactName), key: true },
      { id: "name", label: "企业名称", done: filled(profile.name), key: false },
      { id: "avatar", label: "头像", done: filled(profile.avatar), key: false },
      { id: "headline", label: "招聘简介", done: filled(profile.headline), key: false },
      { id: "languages", label: "语言", done: filled(profile.languages), key: false },
      { id: "availability", label: "联系时间", done: filled(profile.availability), key: false },
    ];
  }
  const resume = profile.resume;
  return [
    { id: "availability", label: "可上班时间", done: filled(profile.availability), key: true },
    { id: "location", label: "地区", done: filled(profile.location) || !!resume?.regionIds.length, key: true },
    { id: "expectedMinPay", label: "期望时薪", done: resume?.expectedMinPay !== undefined, key: true },
    { id: "languages", label: "语言", done: filled(profile.languages), key: true },
    { id: "experience", label: "经验", done: resume?.experienceYears !== undefined, key: true },
    { id: "name", label: "称呼", done: filled(profile.name), key: false },
    { id: "avatar", label: "头像", done: filled(profile.avatar), key: false },
    { id: "headline", label: "一句话介绍", done: filled(profile.headline), key: false },
    { id: "skills", label: "技能", done: filled(resume?.skills), key: false },
    { id: "bio", label: "个人介绍", done: filled(profile.bio), key: false },
  ];
}

/** 「资料完成度 6/10」 and what is missing, key items first. */
export function profileProgress(items: ChecklistItem[]) {
  const missing = items.filter((item) => !item.done).sort((a, b) => Number(b.key) - Number(a.key));
  return { done: items.length - missing.length, total: items.length, missing };
}
