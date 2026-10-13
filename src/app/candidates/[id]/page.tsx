import type { Metadata } from "next";
import { Suspense } from "react";
import { CandidatePublicPage } from "@/components/seeker/CandidatePublicPage";

export const metadata: Metadata = { title: "求职者主页", robots: { index: false } };

export default function Page() {
  return <Suspense fallback={<p role="status" className="py-8 text-sm text-muted">正在加载主页…</p>}><CandidatePublicPage /></Suspense>;
}
