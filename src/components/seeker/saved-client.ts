"use client";

// Which jobs the signed-in account saved (#52), for the 收藏 buttons on a page. The server's list is the truth:
// fetched once per page load and replaced by each answer. A click shows 已收藏 only once the server has it (the
// button is busy until then), so leaving the page right after never shows a save that was lost.
import { useEffect, useSyncExternalStore } from "react";
import { mySavedJobIds, saveMyJob, unsaveMyJob } from "@/app/me/saved/actions";
import { useSession } from "@/components/seeker/session-client";
import { toast } from "@/components/ui/Toast";

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
    .catch(() => {})
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

/** Saves or removes a job; the buttons follow the server's answer, and a toast says what happened (Round 19). */
export async function toggleSaved(jobId: string, save: boolean): Promise<void> {
  setBusy(jobId, true);
  try {
    const answer = await (save ? saveMyJob(jobId) : unsaveMyJob(jobId));
    set(answer ? new Set(answer) : null);
    if (answer) toast(save ? "已收藏，可以在「收藏和进度」里查看" : "已取消收藏");
  } catch {
    // Unchanged: the button still shows what the server has.
    toast(save ? "网络有问题，没有收藏上，请重试" : "网络有问题，没有取消，请重试");
  } finally {
    setBusy(jobId, false);
  }
}
