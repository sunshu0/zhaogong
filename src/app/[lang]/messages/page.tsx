import type { Metadata } from "next";
import { Suspense } from "react";
import { MessagesPage, WorkHubFrame } from "@/components/seeker/WorkHub";
import { SkeletonList } from "@/components/ui/Skeleton";
import { messages } from "@/i18n/server";
import { chatMessages } from "@/i18n/messages/chat";

export async function generateMetadata(): Promise<Metadata> {
  const t = await messages(chatMessages);
  return { title: t.page.title, robots: { index: false } };
}

export default async function Messages() {
  const t = await messages(chatMessages);
  return (
    <WorkHubFrame look="app">
      <Suspense fallback={<SkeletonList count={3} label={t.page.suspense} />}>
        <MessagesPage />
      </Suspense>
    </WorkHubFrame>
  );
}
