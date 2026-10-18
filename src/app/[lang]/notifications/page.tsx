import type { Metadata } from "next";
import { NotificationsPage, WorkHubFrame } from "@/components/seeker/WorkHub";

export const metadata: Metadata = { title: "通知", robots: { index: false } };

export default function Notifications() {
  return (
    <WorkHubFrame look="app">
      <NotificationsPage />
    </WorkHubFrame>
  );
}
