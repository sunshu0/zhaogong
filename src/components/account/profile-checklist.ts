// What a profile still lacks, for 资料完成度 on /profile (C4) and the workspace to-do list (C3).
// `key` items are what the other side looks at first: employers judge a job seeker by when they can work, where,
// for how much, which languages and how much experience; job seekers judge a business by its introduction, where it
// is, whether it is verified and whom they will talk to.
import type { Profile } from "@/components/seeker/hub-state";
import type { EmployerVerification } from "@/lib/types";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { accountMessages } from "@/i18n/messages/account";

export type ChecklistItem = { id: string; label: string; done: boolean; key: boolean };

const filled = (value: string | undefined) => Boolean(value?.trim());

export function profileChecklist(
  profile: Profile,
  isEmployer: boolean,
  verification?: EmployerVerification,
  lang: Lang = DEFAULT_LANG,
): ChecklistItem[] {
  const words = pick(accountMessages, lang).checklist;
  if (isEmployer) {
    const t = words.business;
    return [
      { id: "bio", label: t.bio, done: filled(profile.bio), key: true },
      { id: "location", label: t.location, done: filled(profile.location), key: true },
      { id: "verification", label: t.verification, done: !!verification && verification !== "unverified", key: true },
      { id: "contactName", label: t.contactName, done: filled(profile.contactName), key: true },
      { id: "name", label: t.name, done: filled(profile.name), key: false },
      { id: "avatar", label: t.avatar, done: filled(profile.avatar), key: false },
      { id: "headline", label: t.headline, done: filled(profile.headline), key: false },
      { id: "languages", label: t.languages, done: filled(profile.languages), key: false },
      { id: "availability", label: t.availability, done: filled(profile.availability), key: false },
    ];
  }
  const resume = profile.resume;
  const t = words.seeker;
  return [
    { id: "availability", label: t.availability, done: filled(profile.availability), key: true },
    { id: "location", label: t.location, done: filled(profile.location) || !!resume?.regionIds.length, key: true },
    { id: "expectedMinPay", label: t.expectedMinPay, done: resume?.expectedMinPay !== undefined, key: true },
    { id: "languages", label: t.languages, done: filled(profile.languages), key: true },
    { id: "experience", label: t.experience, done: resume?.experienceYears !== undefined, key: true },
    { id: "name", label: t.name, done: filled(profile.name), key: false },
    { id: "avatar", label: t.avatar, done: filled(profile.avatar), key: false },
    { id: "headline", label: t.headline, done: filled(profile.headline), key: false },
    { id: "skills", label: t.skills, done: filled(resume?.skills), key: false },
    { id: "bio", label: t.bio, done: filled(profile.bio), key: false },
  ];
}

/** 「资料完成度 6/10」 and what is missing, key items first. */
export function profileProgress(items: ChecklistItem[]) {
  const missing = items.filter((item) => !item.done).sort((a, b) => Number(b.key) - Number(a.key));
  return { done: items.length - missing.length, total: items.length, missing };
}
