import type { Metadata } from "next";
import { CompanyPhotos } from "@/components/employer/CompanyPhotos";
import { WorkHubFrame } from "@/components/seeker/WorkHub";
import { employerPhotosMessages } from "@/i18n/messages/employer-photos";
import { messages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = (await messages(employerPhotosMessages)).page;
  return { title: t.title, description: t.description };
}

export default function PhotosPage() {
  // UI review 3: one of the workspace side bar's pages (WorkspaceNav), so it keeps the bar, as 推荐人才 does.
  return (
    <WorkHubFrame>
      <CompanyPhotos />
    </WorkHubFrame>
  );
}
