import type { Metadata } from "next";
import { RedirectEmployer } from "@/components/account/RedirectEmployer";
import { JobAlertsPage } from "@/components/seeker/JobAlertsPage";
import { WorkHubFrame } from "@/components/seeker/WorkHub";
import { MANAGE_JOBS_PATH } from "@/components/ui/nav";
import { messages } from "@/i18n/server";
import { seekerMeMessages } from "@/i18n/messages/seeker-me";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await messages(seekerMeMessages)).pages.alerts, robots: { index: false } };
}

/** 职位提醒 (#53): job seekers only; the employer identity goes to its jobs. */
export default async function JobAlerts() {
  const t = (await messages(seekerMeMessages)).pages;
  return (
    <>
      {/* Outside the frame, which remounts its content when the identity changes. */}
      <RedirectEmployer to={MANAGE_JOBS_PATH} />
      <WorkHubFrame look="app">
        <h1 className="mb-3 text-title font-semibold">{t.alerts}</h1>
        <JobAlertsPage />
      </WorkHubFrame>
    </>
  );
}
