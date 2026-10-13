import type { DemoSession } from "@/components/seeker/session";
import { parseIdentityMap } from "@/components/seeker/identity-scope";
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

const PROFILE_FIELDS: (keyof Profile)[] = [
  "name",
  "contactName",
  "headline",
  "location",
  "languages",
  "availability",
  "bio",
];
export function parseProfiles(raw: string | null): Record<string, Profile> {
  return parseIdentityMap(raw, (value) => {
    if (!value || typeof value !== "object") return undefined;
    const record = value as Record<string, unknown>;
    if (!PROFILE_FIELDS.every((field) => typeof record[field] === "string")) return undefined;
    const details =
      record.privateDetails && typeof record.privateDetails === "object"
        ? (record.privateDetails as Record<string, unknown>)
        : undefined;
    const { avatar: rawAvatar, ...profileFields } = record;
    const avatar =
      typeof rawAvatar === "string" &&
      /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(rawAvatar) &&
      rawAvatar.length <= 180_000
        ? rawAvatar
        : undefined;
    return {
      ...profileFields,
      ...(avatar ? { avatar } : {}),
      ...(record.resume !== undefined ? { resume: parseResume(record.resume) } : {}),
      ...(details
        ? {
            privateDetails: Object.fromEntries(
              ["phone", "wechat", "email", "address"].map((field) => [
                field,
                typeof details[field] === "string" ? details[field].slice(0, 300) : "",
              ]),
            ),
          }
        : {}),
    } as Profile;
  });
}

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

export function parseNotifications(raw: string | null): Record<string, Notification[]> {
  return parseIdentityMap(raw, (value) =>
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        [item.id, item.type, item.title, item.detail, item.time].every((field) => typeof field === "string") &&
        typeof item.unread === "boolean",
    )
      ? (value.map(({ target, ...item }) => {
          const parsedTarget = parseNotificationTarget(target);
          return { ...item, ...(parsedTarget ? { target: parsedTarget } : {}) };
        }) as Notification[])
      : undefined,
  );
}

function parseNotificationTarget(value: unknown): NotificationTarget | undefined {
  if (!value || typeof value !== "object") return undefined;
  const target = value as Record<string, unknown>;
  if (target.type === "profile") return { type: "profile" };
  if (target.type === "conversation" && typeof target.id === "string" && target.id.trim())
    return { type: "conversation", id: target.id };
}

export function notificationHref(item: Notification, session: DemoSession | null): string | undefined {
  if (!session) return undefined;
  // Older saved demo notifications predate explicit conversation targets.
  const target = item.target ?? initialNotifications(session).find((initial) => initial.id === item.id)?.target;
  return target?.type === "conversation"
    ? `/messages?conversation=${encodeURIComponent(target.id)}`
    : target?.type === "profile"
      ? "/profile"
      : undefined;
}
