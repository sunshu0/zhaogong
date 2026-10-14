"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useHydrated, useSession } from "@/components/seeker/session-client";

/**
 * Sends the employer identity elsewhere from a job seeker's page (e.g. /me → 职位管理). Decided once, when the page
 * opens: switching identity on the page navigates by itself, and must not race this.
 */
export function RedirectEmployer({ to }: { to: string }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const isEmployer = useSession()?.activeRole === "employer";
  const decided = useRef(false);
  useEffect(() => {
    if (!hydrated || decided.current) return;
    decided.current = true;
    if (isEmployer) router.replace(to);
  }, [hydrated, isEmployer, router, to]);
  return null;
}
