import type { Metadata } from "next";
import { RedirectEmployer } from "@/components/account/RedirectEmployer";
import { MePage } from "@/components/seeker/MePage";
import { WorkHubFrame } from "@/components/seeker/WorkHub";
import { MANAGE_JOBS_PATH } from "@/components/ui/nav";

export const metadata: Metadata = { title: "浏览与举报", robots: { index: false } };

export default function Me() {
  return (
    <>
      {/* Outside the frame, which remounts its content when the identity changes. */}
      <RedirectEmployer to={MANAGE_JOBS_PATH} />
      <WorkHubFrame>
        <h1 className="mb-3 text-lg font-semibold">浏览与举报</h1>
        <MePage />
      </WorkHubFrame>
    </>
  );
}
