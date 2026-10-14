import type { DemoSession } from "@/components/seeker/session";
import { parseStoredIdentities, scopeRole } from "@/components/seeker/identity-scope";
import { parseResume, type Resume } from "@/lib/candidate-matching";

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
  privateDetails?: { phone: string; wechat: string; email: string; address: string };
};

export function initialProfile(session: DemoSession | null): Profile {
  return session?.activeRole === "employer"
    ? {
        name: session.employerName ?? "",
        contactName: "",
        headline: "",
        location: "",
        languages: "",
        availability: "",
        bio: "",
      }
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
const PRIVATE_FIELDS = ["phone", "wechat", "email", "address"] as const;

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
      return role ? [[scope, { ...initialProfile(role === "employer" ? EMPLOYER : SEEKER), ...patch }]] : [];
    }),
  );
}

// Stand-ins for the defaults of a stored scope; an employer's business name comes from the business itself.
const SEEKER: DemoSession = { email: "", signedInAt: "", activeRole: "seeker" };
const EMPLOYER: DemoSession = { ...SEEKER, activeRole: "employer" };

type NotificationTarget = { type: "conversation"; id: string } | { type: "profile" };
export type Notification = {
  id: string;
  type: string;
  title: string;
  detail: string;
  time: string;
  unread: boolean;
  target?: NotificationTarget;
};
export function initialNotifications(session: DemoSession | null): Notification[] {
  return session?.activeRole === "employer"
    ? [
        {
          id: "e1",
          type: "聊天",
          title: "林晓回复了你的面试邀请",
          detail: "今天下午可以到店面谈。",
          time: "10 分钟前",
          unread: true,
          target: { type: "conversation", id: "candidate-lin" },
        },
        {
          id: "e2",
          type: "简历",
          title: "陈雨发来了简历",
          detail: "应聘前厅服务员，查看求职经历与可工作时间。",
          time: "昨天",
          unread: true,
          target: { type: "conversation", id: "candidate-chen" },
        },
        {
          id: "e3",
          type: "招聘",
          title: "招聘资料待完善",
          detail: "补充企业介绍和工作地址。",
          time: "周一",
          unread: false,
          target: { type: "profile" },
        },
      ]
    : [
        {
          id: "n1",
          type: "聊天",
          title: "北岸早茶酒家回复了你",
          detail: "方便今天下午聊一下吗？",
          time: "10 分钟前",
          unread: true,
          target: { type: "conversation", id: "north-tea" },
        },
        {
          id: "n2",
          type: "职位",
          title: "有一个职位适合你的资料",
          detail: "Mt Eden 餐馆正在招聘前厅服务员",
          time: "昨天",
          unread: true,
          target: { type: "conversation", id: "mt-eden" },
        },
        {
          id: "n3",
          type: "简历",
          title: "洁净家政查看了你的简历",
          detail: "对方可能会在近期联系你",
          time: "周一",
          unread: false,
          target: { type: "conversation", id: "clean-home" },
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

export function notificationsFor(session: DemoSession | null, read: readonly string[]): Notification[] {
  return initialNotifications(session).map((item) => (read.includes(item.id) ? { ...item, unread: false } : item));
}

export function notificationHref(item: Notification, session: DemoSession | null): string | undefined {
  if (!session) return undefined;
  const target = item.target;
  return target?.type === "conversation"
    ? `/messages?conversation=${encodeURIComponent(target.id)}`
    : target?.type === "profile"
      ? "/profile"
      : undefined;
}
