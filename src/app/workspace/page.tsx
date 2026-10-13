import type { Metadata } from "next";
import { WorkHubFrame, WorkspaceOverview } from "@/components/seeker/WorkHub";

export const metadata: Metadata = { title: "工作台", robots: { index: false } };

export default function Workspace() {
  return <WorkHubFrame><WorkspaceOverview /></WorkHubFrame>;
}
