import type { Metadata } from "next";
import { WorkHubFrame, WorkspaceOverview } from "@/components/seeker/WorkHub";
import { messages } from "@/i18n/server";
import { seekerMeMessages } from "@/i18n/messages/seeker-me";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await messages(seekerMeMessages)).pages.workspace, robots: { index: false } };
}

export default function Workspace() {
  return (
    <WorkHubFrame look="app">
      <WorkspaceOverview />
    </WorkHubFrame>
  );
}
