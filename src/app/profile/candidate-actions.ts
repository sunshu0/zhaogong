"use server";

// 推荐人才 from the accounts (#104): the job seekers who allowed it, as an employer identity may see them. Only the
// public part of each page leaves the server (`recommendableCandidates`): no email, no private contact details.
import { getCurrentSession } from "@/lib/auth";
import { listDiscoverableSeekerProfiles } from "@/db/seeker-profiles";
import { resolveProfiles } from "@/components/seeker/hub-state";
import { identityScope } from "@/components/seeker/identity-scope";
import { recommendableCandidates } from "@/lib/candidate-directory";
import { scopeOf } from "@/lib/chat-server/identity";
import type { Candidate } from "@/lib/candidate-matching";

/** `scope` names the identity the answer is for, as with the other per-identity answers. */
export type CandidatesSnapshot = { scope: string; candidates: Candidate[] };

/** Null unless an employer identity is signed in. */
export async function recommendedCandidates(): Promise<CandidatesSnapshot | null> {
  const session = await getCurrentSession();
  if (!session || session.activeRole !== "employer") return null;
  const rows = await listDiscoverableSeekerProfiles();
  const pages = resolveProfiles(
    Object.fromEntries(
      rows.map((row) => [identityScope({ email: row.email, signedInAt: "", activeRole: "seeker" }), row.profile]),
    ),
  );
  return {
    scope: scopeOf(session),
    candidates: recommendableCandidates(pages, { email: session.email, signedInAt: "", activeRole: "employer" }),
  };
}
