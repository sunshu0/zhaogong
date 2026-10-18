import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountDeleted, MyDataPanel } from "@/components/account/MyDataPanel";
import { WorkHubFrame } from "@/components/seeker/WorkHub";
import { SignInGate } from "@/components/seeker/SignInGate";

export const metadata: Metadata = { title: "数据与账号", robots: { index: false } };

export default function AccountData({ searchParams }: PageProps<"/[lang]/account/data">) {
  return (
    <WorkHubFrame look="app">
      {/* Round 19 (操作质感): a large title. */}
      <h1 className="mb-4 text-[1.75rem] leading-tight font-black">数据与账号</h1>
      <Suspense fallback={<div className="h-40 animate-shimmer rounded-card bg-surface shadow-card" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </WorkHubFrame>
  );
}

/** Right after 删除账号 (?deleted=1) it says so; otherwise export and delete, for a signed-in account. */
async function Content({ searchParams }: Pick<PageProps<"/[lang]/account/data">, "searchParams">) {
  const { deleted } = await searchParams;
  if (deleted === "1") return <AccountDeleted />;
  return (
    <SignInGate message="登录后可以导出你的数据或删除账号">
      <MyDataPanel />
    </SignInGate>
  );
}
