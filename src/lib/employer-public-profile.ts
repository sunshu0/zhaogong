import type { Profile } from "@/components/seeker/hub-state";

export type EmployerPublicProfile = Pick<Profile, "name" | "headline" | "location" | "languages" | "availability" | "bio" | "contactName" | "avatar">;

export function employerPublicProfile(profiles: Record<string, Profile>, employerId: string): EmployerPublicProfile | undefined {
  for (const [scope, profile] of Object.entries(profiles)) {
    try {
      const identity: unknown = JSON.parse(scope);
      if (!Array.isArray(identity) || identity.length !== 3 || identity[1] !== "employer" || identity[2] !== employerId) continue;
      return { name: profile.name, headline: profile.headline, location: profile.location, languages: profile.languages,
        availability: profile.availability, bio: profile.bio, contactName: profile.contactName, avatar: profile.avatar };
    } catch { continue; }
  }
}
