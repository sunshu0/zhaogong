import type { Metadata } from "next";
import { RedirectEmployer } from "@/components/account/RedirectEmployer";
import { MyApplications } from "@/components/seeker/MyApplications";
import { SavedJobsPage } from "@/components/seeker/SavedJobsPage";
import { WorkHubFrame } from "@/components/seeker/WorkHub";
import { MANAGE_JOBS_PATH } from "@/components/ui/nav";
import { messages } from "@/i18n/server";
import { seekerMeMessages } from "@/i18n/messages/seeker-me";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await messages(seekerMeMessages)).pages.saved, robots: { index: false } };
}

/** 收藏和进度 (#52): the jobs applied for (#84), then the saved ones. Job seekers only; employers go to their jobs. */
export default async function SavedJobs() {
  const t = (await messages(seekerMeMessages)).pages;
  return (
    <>
      {/* Outside the frame, which remounts its content when the identity changes. */}
      <RedirectEmployer to={MANAGE_JOBS_PATH} />
      <WorkHubFrame look="app">
        <h1 className="mb-3 text-title font-semibold">{t.saved}</h1>
        <MyApplications />
        <SavedJobsPage />
      </WorkHubFrame>
    </>
  );
}
