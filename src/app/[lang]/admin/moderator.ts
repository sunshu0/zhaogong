// Who is asking /admin (#50): the switch first (ADMIN_ENABLED), then a signed-in session, then the moderator role.
// Server only.
import { getCurrentSession } from "@/lib/auth";
import { isModerator } from "@/db/moderators";
import { requireAdmin } from "@/app/[lang]/admin/enabled";

export type ModeratorCheck = { ok: true; email: string } | { ok: false; reason: "signed_out" | "not_moderator" };

export const REFUSED_ZH: Record<"signed_out" | "not_moderator", string> = {
  signed_out: "请先登录。",
  not_moderator: "只有审核员能使用审核后台。",
};

/** Throws while /admin is switched off; otherwise the signed-in moderator, or why the request is refused. */
export async function requireModerator(): Promise<ModeratorCheck> {
  requireAdmin();
  const session = await getCurrentSession();
  if (!session) return { ok: false, reason: "signed_out" };
  if (!(await isModerator(session.email))) return { ok: false, reason: "not_moderator" };
  return { ok: true, email: session.email };
}
