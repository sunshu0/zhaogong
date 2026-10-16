"use server";

// 我的主页 on the server (#104, PRD R-35): the job seeker identity's page belongs to the account, so it is there on
// any device. The account is the one in this browser's session cookie; the server keeps only what it parses.
import { getCurrentSession } from "@/lib/auth";
import { getSeekerProfile, saveSeekerProfile } from "@/db/seeker-profiles";
import { parseProfilePatch, type Profile } from "@/components/seeker/hub-state";
import { scopeOf } from "@/lib/chat-server/identity";

/**
 * The account's page as the server has it: `profile` is null when it never saved one. `scope` names the identity
 * the answer is for, so a browser that switched identity meanwhile does not take it for another one.
 */
export type ProfileSnapshot = { scope: string; profile: Partial<Profile> | null; updatedAt: string | null };

/** Larger than any page the editor can make (the photo is at most 180 kB). */
const MAX_PROFILE_JSON = 250_000;

async function seeker() {
  const session = await getCurrentSession();
  return session && session.activeRole === "seeker" ? session : null;
}

/** Null when signed out or signed in as an employer (the 企业主页 stays in the browser). */
export async function myProfile(): Promise<ProfileSnapshot | null> {
  const session = await seeker();
  if (!session) return null;
  const row = await getSeekerProfile(session.email);
  return { scope: scopeOf(session), profile: row?.profile ?? null, updatedAt: row?.updatedAt ?? null };
}

/** Saves the whole page the browser has. Null when there is no job seeker signed in or the page is not one. */
export async function saveMyProfile(profile: unknown): Promise<ProfileSnapshot | null> {
  const session = await seeker();
  if (!session) return null;
  if (JSON.stringify(profile ?? null).length > MAX_PROFILE_JSON) return null;
  const parsed = parseProfilePatch(profile);
  if (!parsed) return null;
  const row = await saveSeekerProfile(session.email, parsed);
  if (row === "no_account") return null;
  return { scope: scopeOf(session), profile: row.profile, updatedAt: row.updatedAt };
}
