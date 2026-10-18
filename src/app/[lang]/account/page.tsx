import type { Metadata } from "next";
import { AccountHome } from "@/components/account/AccountHome";
import { WorkHubFrame } from "@/components/seeker/WorkHub";
import { SignInGate } from "@/components/seeker/SignInGate";
import { accountMessages } from "@/i18n/messages/account";
import { messages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await messages(accountMessages)).title, robots: { index: false } };
}

export default async function Account() {
  const t = await messages(accountMessages);
  return (
    <WorkHubFrame look="app">
      <SignInGate message={t.signInFor}>
        <AccountHome />
      </SignInGate>
    </WorkHubFrame>
  );
}
