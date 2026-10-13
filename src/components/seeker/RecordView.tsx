"use client";

import { useEffect } from "react";
import { rememberView } from "@/components/seeker/activity-client";
import { useSession } from "@/components/seeker/session-client";
import { identityScope } from "@/components/seeker/identity-scope";

/** Adds the job to this device's 最近看过 list for /me. Renders nothing. */
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
  return null;
}
