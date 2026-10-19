"use client";

// Which jobs the signed-in account applied for (#84), for 已申请 on the job rows. The server's list is the truth:
// fetched once per page load, and again after the account applies or withdraws (refreshApplied).
import { useEffect, useSyncExternalStore } from "react";
import { myAppliedJobIds } from "@/app/[lang]/jobs/[id]/apply-actions";
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

// Only the latest ask's answer is kept: a refresh after applying may cross the page's first load.
let latest = 0;

function ask() {
  const n = ++latest;
  loading = true;
  myAppliedJobIds()
    .then((answer) => n === latest && set(answer ? new Set(answer) : null))
    // No answer (#250): ask again once the browser is back online, not only on the next page.
    .catch(() => n === latest && window.addEventListener("online", load, { once: true }))
    .finally(() => {
      if (n === latest) loading = false;
    });
}

/** Asks the server again (after applying or withdrawing). */
export function refreshApplied(): void {
  ask();
}

function load() {
  if (ids || loading) return;
  ask();
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
