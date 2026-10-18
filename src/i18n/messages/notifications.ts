// Round 20 (ADR 0023): the notification list's frame — NotificationWorkspace.tsx and app/notifications. Each
// notification's own words belong to the module that makes it (applications, interviews, verification, alerts…).

import type { Dictionary } from "@/i18n/messages";

const notificationsZh = {
  title: "通知",
  loading: "正在加载通知",
  seekerHeading: "求职通知",
  employerHeading: "招聘通知",
  markAllRead: "全部标为已读",
  allMarkedRead: "已全部标为已读",
  listLabel: "通知列表",
  all: "全部通知",
  unreadCount: (n: number) => `${n} 条未读`,
  allRead: "已全部读完",
  empty: "还没有通知。",
  unread: "未读",
};

export const notificationsMessages: Dictionary<typeof notificationsZh> = {
  zh: notificationsZh,
  en: {
    title: "Notifications",
    loading: "Loading notifications",
    seekerHeading: "Job seeker notifications",
    employerHeading: "Hiring notifications",
    markAllRead: "Mark all as read",
    allMarkedRead: "All marked as read",
    listLabel: "Notification list",
    all: "All notifications",
    unreadCount: (n) => `${n} unread`,
    allRead: "All read",
    empty: "No notifications yet.",
    unread: "Unread",
  },
};
