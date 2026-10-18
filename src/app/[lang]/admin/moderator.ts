// Who is asking /admin (#50): the switch first (ADMIN_ENABLED), then a signed-in session, then the moderator role.
// Server only.
import { getCurrentSession } from "@/lib/auth";
import { isModerator } from "@/db/moderators";
import { requireAdmin } from "@/app/[lang]/admin/enabled";
import { pick } from "@/i18n/messages";
import { adminMessages } from "@/i18n/messages/admin";
import { requestLang } from "@/i18n/server";

export type ModeratorCheck = { ok: true; email: string } | { ok: false; reason: "signed_out" | "not_moderator" };

/** Why a request is refused, in Chinese (refusedText for the visitor's language). */
export const REFUSED_ZH: Record<"signed_out" | "not_moderator", string> = {
  signed_out: adminMessages.zh.access.signedOut,
  not_moderator: adminMessages.zh.access.notModerator,
};

/** Why a request is refused, in the language of the request (Round 20). */
export async function refusedText(reason: "signed_out" | "not_moderator"): Promise<string> {
  const t = pick(adminMessages, await requestLang()).access;
  return reason === "signed_out" ? t.signedOut : t.notModerator;
}

/** Throws while /admin is switched off; otherwise the signed-in moderator, or why the request is refused. */
export async function requireModerator(): Promise<ModeratorCheck> {
  requireAdmin();
  const session = await getCurrentSession();
  if (!session) return { ok: false, reason: "signed_out" };
  if (!(await isModerator(session.email))) return { ok: false, reason: "not_moderator" };
  return { ok: true, email: session.email };
}
