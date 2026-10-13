import type { Metadata } from "next";
import { Suspense } from "react";
import { MessagesPage, WorkHubFrame } from "@/components/seeker/WorkHub";

export const metadata: Metadata = { title: "聊天", robots: { index: false } };

export default function Messages() {
  return <WorkHubFrame><Suspense fallback={<p role="status">加载聊天…</p>}><MessagesPage /></Suspense></WorkHubFrame>;
}
