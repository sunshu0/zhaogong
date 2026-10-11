"use client";
// Employers sign in with line A's demo sign-in (one session for the whole site). This module only
// remembers which demo business each email posts for, in localStorage next to that session.
import { useMemo } from "react";
import { createLocalStore, useHydrated } from "@/components/seeker/local-store";
import { normalizeEmail } from "@/components/seeker/session";
import { signIn, signOut, useSession } from "@/components/seeker/session-client";
import { parseLinks } from "@/components/employer/employer-links";

export interface EmployerSession {
  email: string;
  /** The demo business this email posts for; missing until one is picked. */
  employerId?: string;
}

const LINK_KEY = "zhaogong:employer-links";
const links = createLocalStore(LINK_KEY, parseLinks);

/** `undefined` during server rendering and hydration, then the session or null when signed out. */
export function useEmployerSession(): EmployerSession | null | undefined {
  const hydrated = useHydrated();
  const session = useSession();
  const map = links.useValue();
  const email = session?.email;
  const employerId = email ? map[email] : undefined;
  return useMemo(() => {
    if (!hydrated) return undefined;
    if (!email) return null;
    return employerId ? { email, employerId } : { email };
  }, [hydrated, email, employerId]);
}

/** Picks the business the signed-in email posts for. */
export function linkEmployer(email: string, employerId: string) {
  links.update((storage) => {
    const map = parseLinks(storage.getItem(LINK_KEY));
    storage.setItem(LINK_KEY, JSON.stringify({ ...map, [normalizeEmail(email)]: employerId }));
  });
}

export function signInEmployer(email: string, employerId: string) {
  signIn(email);
  linkEmployer(email, employerId);
}

/** Signs out of the whole site; the email keeps its business for next time. */
export function signOutEmployer() {
  signOut();
}
