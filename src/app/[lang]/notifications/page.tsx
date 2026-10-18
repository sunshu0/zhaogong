import type { Metadata } from "next";
import { NotificationsPage, WorkHubFrame } from "@/components/seeker/WorkHub";
import { notificationsMessages } from "@/i18n/messages/notifications";
import { messages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await messages(notificationsMessages)).title, robots: { index: false } };
}

export default function Notifications() {
  return (
    <WorkHubFrame look="app">
      <NotificationsPage />
    </WorkHubFrame>
  );
}
