import type { Metadata } from "next";
import { ProfilePage, WorkHubFrame } from "@/components/seeker/WorkHub";

export const metadata: Metadata = { title: "我的主页", robots: { index: false } };

export default function Profile() {
  return <WorkHubFrame><ProfilePage /></WorkHubFrame>;
}
