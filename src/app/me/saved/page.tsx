import type { Metadata } from "next";
import { RedirectEmployer } from "@/components/account/RedirectEmployer";
import { MyApplications } from "@/components/seeker/MyApplications";
import { SavedJobsPage } from "@/components/seeker/SavedJobsPage";
import { WorkHubFrame } from "@/components/seeker/WorkHub";
import { MANAGE_JOBS_PATH } from "@/components/ui/nav";

export const metadata: Metadata = { title: "收藏和进度", robots: { index: false } };

/** 收藏和进度 (#52): the jobs applied for (#84), then the saved ones. Job seekers only; employers go to their jobs. */
export default function SavedJobs() {
  return (
    <>
      {/* Outside the frame, which remounts its content when the identity changes. */}
      <RedirectEmployer to={MANAGE_JOBS_PATH} />
      <WorkHubFrame>
        <h1 className="mb-3 text-lg font-semibold">收藏和进度</h1>
        <MyApplications />
        <SavedJobsPage />
      </WorkHubFrame>
    </>
  );
}
