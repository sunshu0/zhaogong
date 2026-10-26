import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { MessagesPage, WorkHubFrame } from "@/components/seeker/WorkHub";
import { SkeletonList } from "@/components/ui/Skeleton";
import { messages } from "@/i18n/server";
import { chatMessages } from "@/i18n/messages/chat";

export async function generateMetadata(): Promise<Metadata> {
  const t = await messages(chatMessages);
  return { title: t.page.title, robots: { index: false } };
}

/**
 * T1 (ADR 0042): the phone's keyboard shrinks the page here (the layout's other viewport settings stay), so the
 * full-screen chat's box sits on the keyboard. Only here: on the other pages a fixed bottom bar would ride up over
 * the form being filled in.
 */
export const viewport: Viewport = { interactiveWidget: "resizes-content" };

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
