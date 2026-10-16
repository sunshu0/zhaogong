"use client";
import { useCallback, useEffect, useState } from "react";
import type { Employer } from "@/lib/types";
import { getMyEmployer, getMyVerification, type MyVerification } from "@/app/employer/actions";

/**
 * The account's business as the server has it now: verification and a ban can change after the session
 * was written, so badges and the banned notice read this, not the session's copy.
 */
export function useEmployerProfile(email: string | undefined) {
  const [loaded, setLoaded] = useState<{ email: string; employer: Employer | null }>();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!email) return;
    let live = true;
    getMyEmployer().then((employer) => {
      if (live) setLoaded({ email, employer });
    });
    return () => {
      live = false;
    };
  }, [email, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { profile: email && loaded?.email === email ? (loaded.employer ?? undefined) : undefined, reload };
}

/** The business's latest 企业验证 application (#78): undefined while loading, null when it never applied. */
export function useMyVerification(email: string | undefined) {
  const [loaded, setLoaded] = useState<{ email: string; request: MyVerification | null }>();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!email) return;
    let live = true;
    getMyVerification().then((request) => {
      if (live) setLoaded({ email, request });
    });
    return () => {
      live = false;
    };
  }, [email, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { request: email && loaded?.email === email ? loaded.request : undefined, reload };
}
