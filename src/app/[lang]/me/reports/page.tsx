import type { Metadata } from "next";
import { MyReportsPage } from "@/components/seeker/MyReportsPage";
import { WorkHubFrame } from "@/components/seeker/WorkHub";
import { messages } from "@/i18n/server";
import { myReportsMessages } from "@/i18n/messages/my-reports";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await messages(myReportsMessages)).title, robots: { index: false } };
}

/** 我的举报 (S2, #390): the reports sent from this device and whether each is still being handled. */
export default async function MyReports() {
  const t = await messages(myReportsMessages);
  return (
    <WorkHubFrame look="app">
      <h1 className="mb-3 text-title font-semibold">{t.title}</h1>
      <MyReportsPage />
    </WorkHubFrame>
  );
}
