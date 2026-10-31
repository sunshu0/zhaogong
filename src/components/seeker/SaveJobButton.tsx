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
 * title link. It changes the moment it is pressed (#405, saved-client). `look="bar"`: an icon the size of the job
 * page's other actions, in its bar fixed at the bottom of a phone (T8). `className` is added to the button.
 */
export function SaveJobButton({
  jobId,
  title,
  look = "inline",
  className = "",
}: {
  jobId: string;
  title: string;
  look?: "inline" | "bar";
  className?: string;
}) {
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
  // Chromium, so a keyboard user would be thrown to the top of the page after each 收藏 (#179). It does not look
  // dimmed then: the change already shows (#405).
  // T9 (#405): 44 px to press. The inline one keeps the row's height with negative margins.
  const shape =
    look === "bar"
      ? "pressable flex size-12 shrink-0 justify-center rounded-control border border-brand/40 bg-surface hover:bg-brand-soft"
      : `pressable relative z-10 inline-flex -my-1.5 min-h-11 min-w-11 gap-1 rounded-control px-1.5 text-meta hover:text-brand ${
          on ? "text-brand" : "text-muted"
        }`;
  return (
    <button
      type="button"
      disabled={!hydrated}
      aria-disabled={busy || undefined}
      aria-busy={busy || undefined}
      aria-pressed={session ? on : undefined}
      // The inline one's name starts with what it shows, 收藏 or 已收藏, then the job (WCAG 2.5.3, UI audit 1 #7); the
      // bar's is an icon only. In aria-label, not a sr-only span: Chromium puts a space before an absolutely placed one.
      aria-label={look === "inline" && on ? t.savedLabel(title) : t.label(title)}
      title={look === "bar" ? (on ? t.saved : t.save) : undefined}
      onClick={() => {
        if (busy) return;
        if (!session) router.push(saveAfterSignInHref(`${location.pathname}${location.search}`, jobId));
        else void toggleSaved(jobId, !on, lang);
      }}
      className={`${shape} items-center disabled:opacity-60 ${look === "bar" ? "text-brand" : ""} ${className}`.trim()}
    >
      <Bookmark
        aria-hidden="true"
        className={look === "bar" ? "size-5" : "size-4"}
        fill={on ? "currentColor" : "none"}
      />
      {look === "inline" && (on ? t.saved : t.save)}
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
