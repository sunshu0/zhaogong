import type { Metadata } from "next";
import { Suspense } from "react";
import { CandidatePublicPage } from "@/components/seeker/CandidatePublicPage";
import { SkeletonList } from "@/components/ui/Skeleton";
import { messages } from "@/i18n/server";
import { seekerProfileMessages } from "@/i18n/messages/seeker-profile";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await messages(seekerProfileMessages)).pages.candidate, robots: { index: false } };
}

export default async function Page() {
  const t = (await messages(seekerProfileMessages)).pages;
  return (
    <div className="type-app">
      <Suspense fallback={<SkeletonList count={2} label={t.loadingProfileEllipsis} />}>
        <CandidatePublicPage />
      </Suspense>
    </div>
  );
}
