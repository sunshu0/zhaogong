import type { Metadata } from "next";
import { CandidateRecommendations } from "@/components/employer/CandidateRecommendations";
import { WorkHubFrame } from "@/components/seeker/WorkHub";
import { employerApplicantsMessages } from "@/i18n/messages/employer-applicants";
import { messages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await messages(employerApplicantsMessages);
  return { title: t.candidatesPage.metaTitle, robots: { index: false } };
}

export default function CandidatesPage() {
  return (
    <WorkHubFrame>
      <CandidateRecommendations />
    </WorkHubFrame>
  );
}
