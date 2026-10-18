// The job-seeker identity's notifications about team invitations (#87): one per invitation waiting for an answer,
// leading to 我的 where it is accepted or declined. Not a Server Function: it takes the email, so only server code
// that read the email from the session calls it (messages/server-notifications.ts). Server only.
import { getAccount } from "@/lib/data";
import { invitesFor } from "@/db/team";
import { teamRoleLabel } from "@/components/employer/team";
import { postedAgo } from "@/components/seeker/format";
import type { Notification } from "@/components/seeker/hub-state";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { employerTeamMessages } from "@/i18n/messages/employer-team";

export async function myTeamInviteNotifications(
  email: string,
  now: number,
  lang: Lang = DEFAULT_LANG,
): Promise<Notification[]> {
  if ((await getAccount(email))?.employerId) return [];
  // Built when the hub is read, not when the invitation is written, so it is in the reader's language (ADR 0023).
  const t = pick(employerTeamMessages, lang).teamNotifications;
  const roles = teamRoleLabel(lang);
  return (await invitesFor(email)).reverse().map((invite) => ({
    id: `team-invite:${invite.id}`,
    type: t.type,
    title: t.title(invite.employerName),
    detail: t.detail(roles[invite.role]),
    time: postedAgo(invite.createdAt, now, lang),
    unread: true,
    target: { type: "team_invite" },
  }));
}
