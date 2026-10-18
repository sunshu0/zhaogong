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
  // A notification's kind, from the data's own key (申请, 面试…): the first letter shows in its round badge.
  types: {
    application: "申请",
    hiring: "招聘",
    team: "团队",
    verification: "验证",
    alert: "提醒",
    interview: "面试",
    chat: "聊天",
    resume: "简历",
    job: "职位",
  },
  // The round badge's mark for each kind: one character in Chinese, a short distinct mark in English.
  badges: {
    application: "申",
    hiring: "招",
    team: "团",
    verification: "验",
    alert: "提",
    interview: "面",
    chat: "聊",
    resume: "简",
    job: "职",
  },
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
    types: {
      application: "Application",
      hiring: "Hiring",
      team: "Team",
      verification: "Verification",
      alert: "Alert",
      interview: "Interview",
      chat: "Chat",
      resume: "CV",
      job: "Job",
    },
    badges: {
      application: "Ap",
      hiring: "Hi",
      team: "Te",
      verification: "Ve",
      alert: "Al",
      interview: "In",
      chat: "Ch",
      resume: "CV",
      job: "Jo",
    },
  },
};
