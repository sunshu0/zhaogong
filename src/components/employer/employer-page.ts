// 企业主页 on the server (ADR 0022): which part of the page the business shares, and who may change it. The page is
// the same shape as a 求职者主页 (hub-state.ts `Profile`); the business keeps only its public fields. The 私密交换资料
// stay with each person in their own browser, since each teammate gives their own phone and WeChat in a chat. Pure.
import { parseProfilePatch, type Profile } from "@/components/seeker/hub-state";
import type { EmployerPublicProfile } from "@/lib/employer-public-profile";
import { teamCan, type TeamRole } from "@/components/employer/team";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { employerPageMessages } from "@/i18n/messages/employer-page";

/** The fields everyone sees on the business's page, and the only ones the server keeps. */
export const EMPLOYER_PAGE_FIELDS = [
  "name",
  "contactName",
  "headline",
  "location",
  "languages",
  "availability",
  "bio",
  "avatar",
] as const satisfies readonly (keyof EmployerPublicProfile)[];

export type EmployerPageField = (typeof EMPLOYER_PAGE_FIELDS)[number];

/** What the business changed of its page, as the server stores it and the browser sends it. */
export type EmployerPage = Partial<Pick<Profile, EmployerPageField>>;

/** Larger than any page the editor can make (the photo is at most 180 kB). */
export const MAX_EMPLOYER_PAGE_JSON = 250_000;

const isPageField = (key: string): key is EmployerPageField =>
  (EMPLOYER_PAGE_FIELDS as readonly string[]).includes(key);

/** The business's part of a page; whatever else the browser keeps for the identity is left out. */
export function pagePart(page: Partial<Profile> | undefined): EmployerPage {
  const part: EmployerPage = {};
  for (const [key, value] of Object.entries(page ?? {}))
    if (isPageField(key) && value !== undefined) Object.assign(part, { [key]: value });
  return part;
}

/** What is not the business's: the person's own 私密交换资料 and anything a job seeker page has. */
export function personalPart(page: Partial<Profile> | undefined): Partial<Profile> {
  return Object.fromEntries(Object.entries(page ?? {}).filter(([key]) => !isPageField(key))) as Partial<Profile>;
}

/** Whether a change touches the business's page (and so has to reach the server). */
export function touchesPage(patch: Partial<Profile>): boolean {
  return Object.keys(patch).some(isPageField);
}

/**
 * A page a browser sent, checked field by field the way a 我的主页 is (`parseProfilePatch`), keeping only the
 * business's fields. Undefined when it is not a page at all or is larger than the editor can make.
 */
export function parseEmployerPage(value: unknown): EmployerPage | undefined {
  if (JSON.stringify(value ?? null).length > MAX_EMPLOYER_PAGE_JSON) return undefined;
  const patch = parseProfilePatch(value);
  return patch ? pagePart(patch) : undefined;
}

/** The page as visitors see it: the business's own name until the page gives another, the rest empty until filled. */
export function publicPage(businessName: string, page: EmployerPage): EmployerPublicProfile {
  return {
    name: page.name?.trim() ? page.name : businessName,
    headline: page.headline ?? "",
    location: page.location ?? "",
    languages: page.languages ?? "",
    availability: page.availability ?? "",
    bio: page.bio ?? "",
    contactName: page.contactName ?? "",
    ...(page.avatar ? { avatar: page.avatar } : {}),
  };
}

/** Only an admin changes the business's page (ADR 0012, 0022); a member reads it. */
export function canEditPage(role: TeamRole | undefined): boolean {
  return teamCan(role, "page");
}

/** Why a member sees the page read-only, naming who can change it. */
export function readOnlyNote(admins: readonly string[], lang: Lang = DEFAULT_LANG): string {
  return pick(employerPageMessages, lang).employerPage.readOnlyNote(admins);
}
