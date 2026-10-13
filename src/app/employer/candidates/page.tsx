import type { Metadata } from "next";
import { CandidateRecommendations } from "@/components/employer/CandidateRecommendations";
import { WorkHubFrame } from "@/components/seeker/WorkHub";

export const metadata: Metadata = { title: "推荐人才", robots: { index: false } };

export default function CandidatesPage() {
  return (
    <WorkHubFrame>
      <CandidateRecommendations />
    </WorkHubFrame>
  );
}
