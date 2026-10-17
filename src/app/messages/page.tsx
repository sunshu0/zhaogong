import type { Metadata } from "next";
import { Suspense } from "react";
import { MessagesPage, WorkHubFrame } from "@/components/seeker/WorkHub";
import { SkeletonList } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "聊天", robots: { index: false } };

export default function Messages() {
  return (
    <WorkHubFrame look="app">
      <Suspense fallback={<SkeletonList count={3} label="加载聊天…" />}>
        <MessagesPage />
      </Suspense>
    </WorkHubFrame>
  );
}
