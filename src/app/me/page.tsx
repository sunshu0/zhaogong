import type { Metadata } from "next";
import { MePage } from "@/components/seeker/MePage";
import { WorkHubFrame } from "@/components/seeker/WorkHub";

export const metadata: Metadata = { title: "我的", robots: { index: false } };

export default function Me() {
  return (
    <WorkHubFrame>
      <h1 className="mb-3 text-lg font-semibold">我的</h1>
      <MePage />
    </WorkHubFrame>
  );
}
