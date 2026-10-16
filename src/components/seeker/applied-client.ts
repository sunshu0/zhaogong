"use client";

// Which jobs the signed-in account applied for (#84), for 已申请 on the job rows. The server's list is the truth:
// fetched once per page load, and again after the account applies or withdraws (refreshApplied).
import { useEffect, useSyncExternalStore } from "react";
import { myAppliedJobIds } from "@/app/jobs/[id]/apply-actions";
import { useSession } from "@/components/seeker/session-client";

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

/** Asks the server again (after applying or withdrawing). */
export function refreshApplied(): void {
  myAppliedJobIds()
    .then((answer) => set(answer ? new Set(answer) : null))
    .catch(() => {});
}

function load() {
  if (ids || loading) return;
  loading = true;
  myAppliedJobIds()
    .then((answer) => set(answer ? new Set(answer) : null))
    .catch(() => {})
    .finally(() => {
      loading = false;
    });
}

/** The ids of jobs applied for, or null while signed out or not loaded yet. */
export function useAppliedJobIds(): ReadonlySet<string> | null {
  const signedIn = Boolean(useSession());
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
