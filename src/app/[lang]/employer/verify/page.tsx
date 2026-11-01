import type { Metadata } from "next";
import { VerifyBusiness } from "@/components/employer/VerifyBusiness";
import { WorkHubFrame } from "@/components/seeker/WorkHub";
import { employerVerifyMessages } from "@/i18n/messages/employer-verify";
import { messages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = (await messages(employerVerifyMessages)).page;
  return { title: t.title, description: t.description };
}

export default function VerifyPage() {
  // UI review 3: one of the workspace side bar's pages (WorkspaceNav), so it keeps the bar, as 推荐人才 does.
  return (
    <WorkHubFrame>
      <VerifyBusiness />
    </WorkHubFrame>
  );
}
