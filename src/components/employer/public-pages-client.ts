"use client";

// 企业主页 for visitors (ADR 0022): businesses' public pages come from the server, asked once per business per page
// load. The businesses a page needs at once (its own, or the counterparts of a chat list) go in one ask.
import { useEffect, useSyncExternalStore } from "react";
import { employerPublicPages } from "@/app/employer/page-actions";
import type { EmployerPublicProfile } from "@/lib/employer-public-profile";

/** Per business: its page, null when it has none (or is banned), missing until the server answered. */
type Pages = Readonly<Record<string, EmployerPublicProfile | null>>;

const NONE: Pages = {};
let pages: Pages = NONE;
const listeners = new Set<() => void>();
const asked = new Set<string>();
let waiting: string[] = [];

function publish(next: Pages) {
  pages = next;
  for (const listener of listeners) listener();
}

function ask(employerId: string) {
  if (!employerId || asked.has(employerId)) return;
  asked.add(employerId);
  waiting.push(employerId);
  if (waiting.length === 1) queueMicrotask(flush);
}

function flush() {
  const ids = waiting;
  waiting = [];
  employerPublicPages(ids)
    .then((found) => publish({ ...pages, ...Object.fromEntries(ids.map((id) => [id, found[id] ?? null])) }))
    .catch(() => {
      for (const id of ids) asked.delete(id);
    });
}

/** After the business's own page was saved: the next look asks the server again. */
export function forgetPublicPage(employerId: string) {
  asked.delete(employerId);
  if (employerId in pages) {
    const rest = { ...pages };
    delete rest[employerId];
    publish(rest);
  }
}

/** The business's public page: undefined while asking, null when it has none. */
export function usePublicPage(employerId: string): EmployerPublicProfile | null | undefined {
  const all = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => pages,
    () => NONE,
  );
  const known = employerId in all;
  useEffect(() => {
    if (!known) ask(employerId);
  }, [employerId, known]);
  return all[employerId];
}
