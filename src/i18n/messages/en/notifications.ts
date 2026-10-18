// The English side of notifications.ts (#240): the browser loads it on English pages only (src/i18n/english.ts).
// Typed by the Chinese side: a missing key, an extra key or a different parameter fails tsc.

import type { Messages } from "@/i18n/messages";
import type { notificationsMessages } from "@/i18n/messages/notifications";

export const notificationsEn: Messages<(typeof notificationsMessages)["zh"]> = {
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
  demo: {
    tenMinutesAgo: "10 minutes ago",
    yesterday: "Yesterday",
    monday: "Monday",
    repliedToInvite: (name) => `${name} replied to your interview invitation`,
    sentCv: (name) => `${name} sent a CV`,
    sentCvDetail: (job) => `Applying for ${job}: see their experience and when they can work.`,
    finishProfile: "Your hiring details need finishing",
    finishProfileDetail: "Add an introduction to the business and where the work is.",
    businessReplied: (business) => `${business} replied to you`,
    jobMatch: "A job that fits your profile",
    jobMatchDetail: (place, job) => `A restaurant in ${place} is hiring: ${job}`,
    viewedCv: (business) => `${business} looked at your CV`,
    viewedCvDetail: "They may get in touch soon",
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
};
