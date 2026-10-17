import type { Metadata } from "next";
import { Suspense } from "react";
import { CandidatePublicPage } from "@/components/seeker/CandidatePublicPage";
import { SkeletonList } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "求职者主页", robots: { index: false } };

export default function Page() {
  return (
    <div className="type-app">
      <Suspense fallback={<SkeletonList count={2} label="正在加载主页…" />}>
        <CandidatePublicPage />
      </Suspense>
    </div>
  );
}
