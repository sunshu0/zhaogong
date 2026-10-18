import type { Metadata } from "next";
import { ResumePage } from "@/components/seeker/ResumePage";
import { SignInGate } from "@/components/seeker/SignInGate";
import { WorkHubFrame } from "@/components/seeker/WorkHub";
import { messages } from "@/i18n/server";
import { seekerProfileMessages } from "@/i18n/messages/seeker-profile";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await messages(seekerProfileMessages)).pages.resume, robots: { index: false } };
}

export default async function Resume() {
  const t = (await messages(seekerProfileMessages)).pages;
  return (
    <WorkHubFrame look="app">
      <SignInGate message={t.resumeGate}>
        <ResumePage />
      </SignInGate>
    </WorkHubFrame>
  );
}
