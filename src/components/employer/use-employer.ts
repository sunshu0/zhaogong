"use client";
import { useCallback, useEffect, useState } from "react";
import type { Employer } from "@/lib/types";
import { getEmployerProfile } from "@/app/employer/actions";

/**
 * The employer as the server has it now. Employer pages are prerendered, so the demo account list
 * they carry can be behind on verification or a ban; badges read this instead.
 */
export function useEmployerProfile(employerId: string | undefined) {
  const [loaded, setLoaded] = useState<{ employerId: string; employer: Employer | null }>();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!employerId) return;
    let live = true;
    getEmployerProfile(employerId).then((employer) => {
      if (live) setLoaded({ employerId, employer });
    });
    return () => {
      live = false;
    };
  }, [employerId, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { profile: employerId && loaded?.employerId === employerId ? (loaded.employer ?? undefined) : undefined, reload };
}
