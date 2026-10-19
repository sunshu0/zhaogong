"use client";
import type { Employer } from "@/lib/types";
import { getMyEmployer, getMyVerification, type MyVerification } from "@/app/[lang]/employer/actions";
import { getMyTeam, type MyTeam } from "@/app/[lang]/employer/team-actions";
import { useServerLoad } from "@/components/ui/use-server-load";

/**
 * The account's business as the server has it now: verification and a ban can change after the session
 * was written, so badges and the banned notice read this, not the session's copy. When no answer comes (#246) the
 * pages go on with the session's copy, as while loading.
 */
export function useEmployerProfile(email: string | undefined) {
  const { value, failed, reload } = useServerLoad<Employer | null>(email || undefined, getMyEmployer);
  return { profile: value ?? undefined, failed, reload };
}

/**
 * The business's latest 企业验证 application (#78): undefined while loading, null when it never applied; `failed`
 * when no answer came (#246).
 */
export function useMyVerification(email: string | undefined) {
  const { value, failed, reload } = useServerLoad<MyVerification | null>(email || undefined, getMyVerification);
  return { request: value, failed, reload };
}

/**
 * The business's team as the signed-in person sees it (#87): undefined while loading, null without one; `failed`
 * when no answer came (#246).
 */
export function useMyTeam(email: string | undefined) {
  const { value, failed, reload } = useServerLoad<MyTeam | null>(email || undefined, getMyTeam);
  return { team: value, failed, reload };
}
