import type { Metadata } from "next";
import { TeamPage } from "@/components/employer/TeamPage";
import { WorkHubFrame } from "@/components/seeker/WorkHub";
import { employerTeamMessages } from "@/i18n/messages/employer-team";
import { messages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = (await messages(employerTeamMessages)).teamRoute;
  return { title: t.metaTitle, description: t.metaDescription };
}

export default function EmployerTeamPage() {
  // UI review 3: one of the workspace side bar's pages (WorkspaceNav), so it keeps the bar, as 推荐人才 does.
  return (
    <WorkHubFrame>
      <TeamPage />
    </WorkHubFrame>
  );
}
