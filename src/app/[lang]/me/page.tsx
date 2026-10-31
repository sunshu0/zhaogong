import type { Metadata } from "next";
import { RedirectEmployer } from "@/components/account/RedirectEmployer";
import { MePage } from "@/components/seeker/MePage";
import { demoDataWanted } from "@/db/ready";
import { WorkHubFrame } from "@/components/seeker/WorkHub";
import { MANAGE_JOBS_PATH } from "@/components/ui/nav";
import { messages } from "@/i18n/server";
import { seekerMeMessages } from "@/i18n/messages/seeker-me";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await messages(seekerMeMessages)).pages.history, robots: { index: false } };
}

export default async function Me() {
  const t = (await messages(seekerMeMessages)).pages;
  return (
    <>
      {/* Outside the frame, which remounts its content when the identity changes. */}
      <RedirectEmployer to={MANAGE_JOBS_PATH} />
      <WorkHubFrame look="app">
        <h1 className="mb-3 text-title font-semibold">{t.history}</h1>
        <MePage demo={demoDataWanted()} />
      </WorkHubFrame>
    </>
  );
}
