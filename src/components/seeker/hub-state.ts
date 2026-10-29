import type { DemoSession } from "@/components/seeker/session";
import { isDemoAccount } from "@/lib/demo-accounts";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { notificationsMessages } from "@/i18n/messages/notifications";
import { parseStoredIdentities, scopeRole } from "@/components/seeker/identity-scope";
import { parseResume, type Resume } from "@/lib/candidate-matching";
import {
  parseContactChoice,
  parseEnglish,
  parseWorkRights,
  type ResumeContactChoice,
  type ResumeText,
  type WorkRights,
} from "@/components/seeker/resume-doc";

export type Profile = {
  avatar?: string;
  name: string;
  contactName: string;
  headline: string;
  location: string;
  languages: string;
  availability: string;
  bio: string;
  resume?: Resume;
  privateDetails?: { phone: string; wechat: string; email: string };
  /** For the 中英文简历 (#86): the English the person wrote, their visa as they state it, the contact lines. */
  english?: Partial<ResumeText>;
  workRights?: WorkRights;
  resumeContact?: ResumeContactChoice;
};

const EMPTY_PAGE: Profile = {
  name: "",
  contactName: "",
  headline: "",
  location: "",
  languages: "",
  availability: "",
  bio: "",
};

/**
 * The page before anyone changed it: empty, with the business's name for a 企业主页. Only a demo account's job seeker
 * page starts as the demo's 林晓 (isDemoAccount, #125), so a real account never carries her details.
 */
export function initialProfile(session: DemoSession | null): Profile {
  if (session?.activeRole === "employer") return { ...EMPTY_PAGE, name: session.employerName ?? "" };
  return !isDemoAccount(session?.email)
    ? EMPTY_PAGE
    : {
        name: "林晓",
        contactName: "",
        headline: "前厅服务 · 中英文沟通",
        location: "奥克兰 · 北岸",
        languages: "普通话、英语",
        availability: "周一至周六，下午可上班",
        bio: "有餐饮服务经验，熟悉点单、收银和前厅接待。希望找到稳定、长期的工作。",
      };
}

const PROFILE_FIELDS = ["name", "contactName", "headline", "location", "languages", "availability", "bio"] as const;
// An address used to be one of them (exchange removed in A24); a stored one is dropped when read.
const PRIVATE_FIELDS = ["phone", "wechat", "email"] as const;

/**
 * What the browser keeps of a profile: only what the user changed. Each field is checked on its own, so one bad
 * or missing field falls back to its default instead of losing the whole profile.
 */
export function parseProfilePatch(value: unknown): Partial<Profile> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const patch: Partial<Profile> = {};
  for (const field of PROFILE_FIELDS) if (typeof record[field] === "string") patch[field] = record[field];
  const avatar = record.avatar;
  if (
    typeof avatar === "string" &&
    /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(avatar) &&
    avatar.length <= 180_000
  )
    patch.avatar = avatar;
  if (record.resume !== undefined) patch.resume = parseResume(record.resume);
  const english = parseEnglish(record.english);
  if (english) patch.english = english;
  const workRights = parseWorkRights(record.workRights);
  if (workRights) patch.workRights = workRights;
  const resumeContact = parseContactChoice(record.resumeContact);
  if (resumeContact) patch.resumeContact = resumeContact;
  if (record.privateDetails && typeof record.privateDetails === "object") {
    const details = record.privateDetails as Record<string, unknown>;
    patch.privateDetails = Object.fromEntries(
      PRIVATE_FIELDS.map((field) => [field, typeof details[field] === "string" ? details[field].slice(0, 300) : ""]),
    ) as Profile["privateDetails"];
  }
  return patch;
}

/** The stored profile changes per identity scope (versioned; older full profiles read as changes too). */
export function parseStoredProfiles(raw: string | null): Record<string, Partial<Profile>> {
  return parseStoredIdentities(raw, parseProfilePatch);
}

/** Every stored identity's profile with its defaults filled in; scopes that name no identity are left out. */
export function parseProfiles(raw: string | null): Record<string, Profile> {
  return resolveProfiles(parseStoredProfiles(raw));
}

export function resolveProfiles(patches: Record<string, Partial<Profile>>): Record<string, Profile> {
  return Object.fromEntries(
    Object.entries(patches).flatMap(([scope, patch]) => {
      const role = scopeRole(scope);
      // A stand-in session for the defaults: the scope's email decides a demo page; an employer's business name
      // comes from the business itself.
      const email = !role ? "" : scope.startsWith("[") ? String((JSON.parse(scope) as unknown[])[0]) : scope;
      return role ? [[scope, { ...initialProfile({ email, signedInAt: "", activeRole: role }), ...patch }]] : [];
    }),
  );
}

type NotificationTarget =
  | { type: "conversation"; id: string }
  | { type: "profile" }
  | { type: "job"; id: string }
  | { type: "external_job"; id: string }
  | { type: "closing_jobs" }
  | { type: "applicants"; jobId: string }
  | { type: "verification" }
  | { type: "photos" }
  | { type: "team_invite" }
  | { type: "applications" };
export type Notification = {
  id: string;
  type: string;
  title: string;
  detail: string;
  time: string;
  unread: boolean;
  target?: NotificationTarget;
  /**
   * What people wrote that appears inside `title` or `detail` (a name, a job's title, a quoted reply): kept as
   * written and marked as theirs (lang) where shown, while the sentence around it follows the page's language.
   */
  marks?: string[];
};
/** The demo notifications: only a demo account has them (isDemoAccount, #110); everyone else starts with none. */
export function initialNotifications(session: DemoSession | null, lang: Lang = DEFAULT_LANG): Notification[] {
  if (!isDemoAccount(session?.email)) return [];
  const t = pick(notificationsMessages, lang).demo;
  // The demo people's own words: names, the demo job's title, and replies quoted from their chats (chat-demo.ts).
  const job = "前厅服务员";
  if (session?.activeRole === "employer") {
    const reply = "今天下午可以到店面谈。";
    return [
      {
        id: "e1",
        type: "聊天",
        title: t.repliedToInvite("林晓"),
        detail: reply,
        time: t.tenMinutesAgo,
        unread: true,
        target: { type: "conversation", id: "candidate-lin" },
        marks: ["林晓", reply],
      },
      {
        id: "e2",
        type: "简历",
        title: t.sentCv("陈雨"),
        detail: t.sentCvDetail(job),
        time: t.yesterday,
        unread: true,
        target: { type: "conversation", id: "candidate-chen" },
        marks: ["陈雨", job],
      },
      {
        id: "e3",
        type: "招聘",
        title: t.finishProfile,
        detail: t.finishProfileDetail,
        time: t.monday,
        unread: false,
        target: { type: "profile" },
      },
    ];
  }
  const reply = "方便今天下午聊一下吗？";
  return [
    {
      id: "n1",
      type: "聊天",
      title: t.businessReplied("北岸早茶酒家"),
      detail: reply,
      time: t.tenMinutesAgo,
      unread: true,
      target: { type: "conversation", id: "north-tea" },
      marks: ["北岸早茶酒家", reply],
    },
    {
      id: "n2",
      type: "职位",
      title: t.jobMatch,
      detail: t.jobMatchDetail("Mt Eden", job),
      time: t.yesterday,
      unread: true,
      target: { type: "conversation", id: "mt-eden" },
      marks: [job],
    },
    {
      id: "n3",
      type: "简历",
      title: t.viewedCv("洁净家政"),
      detail: t.viewedCvDetail,
      time: t.monday,
      unread: false,
      target: { type: "conversation", id: "clean-home" },
      marks: ["洁净家政"],
    },
  ];
}

/**
 * What the browser keeps of the notifications: the ids the user has read. The notifications themselves are
 * demo data, merged in when shown. Older data stored whole lists; their read items carry over.
 */
export function parseNotificationReads(raw: string | null): Record<string, string[]> {
  return parseStoredIdentities(raw, (list, { legacy }) => {
    if (!Array.isArray(list)) return undefined;
    const ids = legacy
      ? list.flatMap((item) => (item && typeof item.id === "string" && item.unread === false ? [item.id] : []))
      : list.filter((id): id is string => typeof id === "string");
    return [...new Set(ids)];
  });
}

/** The identity's notifications, newest first: `fromServer` (jobs its alerts found, #53) before the demo ones. */
export function notificationsFor(
  session: DemoSession | null,
  read: readonly string[],
  fromServer: readonly Notification[] = [],
  lang: Lang = DEFAULT_LANG,
): Notification[] {
  return [...fromServer, ...initialNotifications(session, lang)].map((item) =>
    read.includes(item.id) ? { ...item, unread: false } : item,
  );
}

export function notificationHref(item: Notification, session: DemoSession | null): string | undefined {
  if (!session) return undefined;
  const target = item.target;
  return target?.type === "conversation"
    ? `/messages?conversation=${encodeURIComponent(target.id)}`
    : target?.type === "job"
      ? `/jobs/${encodeURIComponent(target.id)}`
      : target?.type === "profile"
        ? "/profile"
        : target?.type === "closing_jobs"
          ? "/employer/jobs?tab=ending"
          : target?.type === "applicants"
            ? `/employer/jobs/${encodeURIComponent(target.jobId)}/applicants`
            : target?.type === "verification"
              ? "/employer/verify"
              : target?.type === "photos"
                ? "/employer/photos"
                : target?.type === "team_invite"
                  ? "/account#team-invites"
                  : target?.type === "applications"
                    ? "/me/saved"
                    : target?.type === "external_job"
                      ? `/external/${encodeURIComponent(target.id)}`
                      : undefined;
}
