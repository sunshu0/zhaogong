import type { Metadata } from "next";
import { ResumePage } from "@/components/seeker/ResumePage";
import { SignInGate } from "@/components/seeker/SignInGate";
import { WorkHubFrame } from "@/components/seeker/WorkHub";

export const metadata: Metadata = { title: "中英文简历", robots: { index: false } };

export default function Resume() {
  return (
    <WorkHubFrame look="app">
      <SignInGate message="登录后用自己的主页资料生成简历">
        <ResumePage />
      </SignInGate>
    </WorkHubFrame>
  );
}
