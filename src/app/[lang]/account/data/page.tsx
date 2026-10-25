import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountDeleted, MyDataPanel } from "@/components/account/MyDataPanel";
import { WorkHubFrame } from "@/components/seeker/WorkHub";
import { SignInGate } from "@/components/seeker/SignInGate";
import { accountMessages } from "@/i18n/messages/account";
import { messages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await messages(accountMessages)).data.title, robots: { index: false } };
}

export default async function AccountData({ searchParams }: PageProps<"/[lang]/account/data">) {
  const t = await messages(accountMessages);
  return (
    <WorkHubFrame look="app">
      {/* Round 19 (操作质感): a large title. */}
      <h1 className="mb-4 text-[1.75rem] leading-tight font-black">{t.data.title}</h1>
      <Suspense fallback={<div className="h-40 animate-shimmer rounded-card bg-surface ring-1 ring-border" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </WorkHubFrame>
  );
}

/** Right after 删除账号 (?deleted=1) it says so; otherwise export and delete, for a signed-in account. */
async function Content({ searchParams }: Pick<PageProps<"/[lang]/account/data">, "searchParams">) {
  const { deleted } = await searchParams;
  if (deleted === "1") return <AccountDeleted />;
  const t = await messages(accountMessages);
  return (
    <SignInGate message={t.data.signInFor}>
      <MyDataPanel />
    </SignInGate>
  );
}
