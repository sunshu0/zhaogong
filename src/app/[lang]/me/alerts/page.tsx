import type { Metadata } from "next";
import { RedirectEmployer } from "@/components/account/RedirectEmployer";
import { JobAlertsPage } from "@/components/seeker/JobAlertsPage";
import { WorkHubFrame } from "@/components/seeker/WorkHub";
import { MANAGE_JOBS_PATH } from "@/components/ui/nav";

export const metadata: Metadata = { title: "职位提醒", robots: { index: false } };

/** 职位提醒 (#53): job seekers only; the employer identity goes to its jobs. */
export default function JobAlerts() {
  return (
    <>
      {/* Outside the frame, which remounts its content when the identity changes. */}
      <RedirectEmployer to={MANAGE_JOBS_PATH} />
      <WorkHubFrame look="app">
        <h1 className="mb-3 text-title font-semibold">职位提醒</h1>
        <JobAlertsPage />
      </WorkHubFrame>
    </>
  );
}
