import type { Metadata } from "next";
import { ProfilePage, WorkHubFrame } from "@/components/seeker/WorkHub";
import { messages } from "@/i18n/server";
import { seekerProfileMessages } from "@/i18n/messages/seeker-profile";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await messages(seekerProfileMessages)).pages.profile, robots: { index: false } };
}

export default function Profile() {
  return (
    <WorkHubFrame look="app">
      <ProfilePage />
    </WorkHubFrame>
  );
}
