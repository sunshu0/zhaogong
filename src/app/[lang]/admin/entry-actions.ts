"use server";

// Whether this browser's account may open /admin (#73), for the links to it in the account menu and on 我的. The
// same checks as every admin Server Function (requireModerator), answered as yes or no instead of a refusal.
import { adminEnabled } from "@/app/[lang]/admin/enabled";
import { requireModerator } from "@/app/[lang]/admin/moderator";

export async function canModerate(): Promise<boolean> {
  if (!adminEnabled()) return false;
  return (await requireModerator()).ok;
}
