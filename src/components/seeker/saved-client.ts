"use client";

// Which jobs the signed-in account saved (#52), for the 收藏 buttons on a page. The server's list is the truth:
// fetched once per page load and replaced by each answer. A click shows 已收藏 only once the server has it (the
// button is busy until then), so leaving the page right after never shows a save that was lost.
import { useEffect, useSyncExternalStore } from "react";
import { mySavedJobIds, saveMyJob, unsaveMyJob } from "@/app/[lang]/me/saved/actions";
import { useSession } from "@/components/seeker/session-client";
import { toast } from "@/components/ui/Toast";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { seekerJobsMessages } from "@/i18n/messages/seeker-jobs";

let ids: ReadonlySet<string> | null = null;
let loading = false;
const listeners = new Set<() => void>();

function set(next: ReadonlySet<string> | null) {
  ids = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function load() {
  if (ids || loading) return;
  loading = true;
  mySavedJobIds()
    .then((answer) => set(answer ? new Set(answer) : null))
    // No answer (#250): ask again once the browser is back online, not only on the next page.
    .catch(() => window.addEventListener("online", load, { once: true }))
    .finally(() => {
      loading = false;
    });
}

/** The saved job ids, or null while signed out or not loaded yet. */
export function useSavedJobIds(): ReadonlySet<string> | null {
  const session = useSession();
  const signedIn = Boolean(session);
  useEffect(() => {
    if (signedIn) load();
    else if (ids) set(null);
  }, [signedIn]);
  return useSyncExternalStore(
    subscribe,
    () => ids,
    () => null,
  );
}

let busy: ReadonlySet<string> = new Set();

/** Jobs whose save or removal is on its way to the server. */
export function useBusySavedJobs(): ReadonlySet<string> {
  return useSyncExternalStore(
    subscribe,
    () => busy,
    () => EMPTY,
  );
}
const EMPTY: ReadonlySet<string> = new Set();

function setBusy(jobId: string, on: boolean) {
  const next = new Set(busy);
  if (on) next.add(jobId);
  else next.delete(jobId);
  busy = next;
  for (const listener of listeners) listener();
}

/**
 * Saves or removes a job; the buttons follow the server's answer, and a toast says what happened (Round 19), in the
 * page's language (`lang`, from the caller's useLang()).
 */
export async function toggleSaved(jobId: string, save: boolean, lang: Lang = DEFAULT_LANG): Promise<void> {
  const t = pick(seekerJobsMessages, lang).save;
  setBusy(jobId, true);
  try {
    const answer = await (save ? saveMyJob(jobId) : unsaveMyJob(jobId));
    set(answer ? new Set(answer) : null);
    if (answer) toast(save ? t.savedToast : t.unsavedToast);
  } catch {
    // Unchanged: the button still shows what the server has.
    toast(save ? t.saveFailed : t.unsaveFailed);
  } finally {
    setBusy(jobId, false);
  }
}
