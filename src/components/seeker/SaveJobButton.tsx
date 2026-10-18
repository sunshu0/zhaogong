"use client";

import { Bookmark } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { SAVE_PARAM, saveAfterSignInHref } from "@/components/seeker/saved-jobs";
import { toggleSaved, useBusySavedJobs, useSavedJobIds } from "@/components/seeker/saved-client";
import { useHydrated, useSession } from "@/components/seeker/session-client";
import { useLang, useMessages } from "@/i18n/client";
import { seekerJobsMessages } from "@/i18n/messages/seeker-jobs";

/**
 * 收藏 on a job (#52): a toggle for job seekers. Signed out, it goes to sign-in and comes back to this page, which
 * then finishes saving (FinishSaveAfterSignIn). Not shown in the employer identity. Sits above the row's stretched
 * title link.
 */
export function SaveJobButton({ jobId, title }: { jobId: string; title: string }) {
  const hydrated = useHydrated();
  const session = useSession();
  const saved = useSavedJobIds();
  const busy = useBusySavedJobs().has(jobId);
  const router = useRouter();
  const lang = useLang();
  const t = useMessages(seekerJobsMessages).save;
  if (hydrated && session?.activeRole === "employer") return null;
  const on = Boolean(session && saved?.has(jobId));

  // While the server answers, the button is aria-disabled, not disabled: a disabled button loses the focus in
  // Chromium, so a keyboard user would be thrown to the top of the page after each 收藏 (#179).
  return (
    <button
      type="button"
      disabled={!hydrated}
      aria-disabled={busy || undefined}
      aria-busy={busy || undefined}
      aria-pressed={session ? on : undefined}
      aria-label={t.label(title)}
      onClick={() => {
        if (busy) return;
        if (!session) router.push(saveAfterSignInHref(`${location.pathname}${location.search}`, jobId));
        else void toggleSaved(jobId, !on, lang);
      }}
      className={`relative z-10 inline-flex min-h-8 items-center gap-1 rounded-control px-1.5 text-meta after:absolute after:inset-x-0 after:-inset-y-1.5 hover:text-brand disabled:opacity-60 aria-disabled:opacity-60 ${
        on ? "text-brand" : "text-muted"
      }`}
    >
      <Bookmark aria-hidden="true" className="size-4" fill={on ? "currentColor" : "none"} />
      {on ? t.saved : t.save}
    </button>
  );
}

/** After sign-in from 收藏 (saveAfterSignInHref): saves the job named in the URL, then drops it from the URL. */
export function FinishSaveAfterSignIn() {
  const session = useSession();
  const router = useRouter();
  const lang = useLang();
  useEffect(() => {
    if (!session || session.activeRole === "employer") return;
    const url = new URL(location.href);
    const jobId = url.searchParams.get(SAVE_PARAM);
    if (!jobId) return;
    url.searchParams.delete(SAVE_PARAM);
    void toggleSaved(jobId, true, lang);
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
  }, [session, router, lang]);
  return null;
}
