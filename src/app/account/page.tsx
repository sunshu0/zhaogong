import type { Metadata } from "next";
import { AccountHome } from "@/components/account/AccountHome";
import { WorkHubFrame } from "@/components/seeker/WorkHub";
import { SignInGate } from "@/components/seeker/SignInGate";

export const metadata: Metadata = { title: "我的", robots: { index: false } };

export default function Account() {
  return (
    <WorkHubFrame>
      <SignInGate message="登录后查看你的资料、通知和记录">
        <AccountHome />
      </SignInGate>
    </WorkHubFrame>
  );
}
