"use client";

import { useEffect } from "react";
import { countJobView } from "@/app/[lang]/employer/count-view";
import { rememberView } from "@/components/seeker/activity-client";
import { useSession } from "@/components/seeker/session-client";
import { identityScope } from "@/components/seeker/identity-scope";

const countedThisLoad = new Set<string>();

/** Adds the job to this device's 最近看过 list for /me, and counts the view for the employer (#55). Renders nothing. */
export function RecordView({
  jobId,
  title,
  pay,
  region,
}: {
  jobId: string;
  title: string;
  pay: string;
  region: string;
}) {
  const scope = identityScope(useSession());
  useEffect(() => {
    rememberView({ jobId, title, pay, region, at: new Date().toISOString() });
  }, [jobId, title, pay, region, scope]);
  useEffect(() => {
    // Once per page load: until the first answer sets the browser's id cookie, a second call would count twice.
    if (countedThisLoad.has(jobId)) return;
    countedThisLoad.add(jobId);
    void countJobView(jobId).catch(() => {});
  }, [jobId]);
  return null;
}
