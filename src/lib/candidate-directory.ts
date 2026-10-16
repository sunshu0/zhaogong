import { identityScope } from "@/components/seeker/identity-scope";
import type { DemoSession } from "@/components/seeker/session";
import type { Profile } from "@/components/seeker/hub-state";
import type { Candidate } from "@/lib/candidate-matching";

/**
 * The job seekers an employer identity may be recommended: pages whose owner turned on 允许向雇主推荐 and gave a
 * name, never the employer's own job seeker page. `profiles` are keyed by identity scope; since #104 they come from
 * the accounts on the server (`recommendedCandidates`), before that from this browser.
 */
export function recommendableCandidates(profiles: Record<string, Profile>, session: DemoSession | null): Candidate[] {
  if (!session || session.activeRole !== "employer") return [];
  const ownSeeker = identityScope({ ...session, activeRole: "seeker" });
  return Object.entries(profiles).flatMap(([scope, profile]) => {
    try {
      const identity: unknown = JSON.parse(scope);
      if (
        !Array.isArray(identity) ||
        identity[1] !== "seeker" ||
        scope === ownSeeker ||
        !profile.resume?.discoverable ||
        !profile.resume.candidateId ||
        !profile.name.trim()
      )
        return [];
      // Only public resume fields leave the profile store; no account identifier or contact data.
      return [
        {
          id: `local-${profile.resume.candidateId}`,
          source: "local" as const,
          name: profile.name,
          avatar: profile.avatar,
          headline: profile.headline,
          location: profile.location,
          languages: profile.languages,
          availability: profile.availability,
          bio: profile.bio,
          resume: profile.resume,
        },
      ];
    } catch {
      return [];
    }
  });
}
