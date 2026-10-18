// The job-seeker identity's notifications about team invitations (#87): one per invitation waiting for an answer,
// leading to 我的 where it is accepted or declined. Not a Server Function: it takes the email, so only server code
// that read the email from the session calls it (messages/server-notifications.ts). Server only.
import { getAccount } from "@/lib/data";
import { invitesFor } from "@/db/team";
import { TEAM_ROLE_LABEL } from "@/components/employer/team";
import { postedAgoZh } from "@/components/seeker/format";
import type { Notification } from "@/components/seeker/hub-state";

export async function myTeamInviteNotifications(email: string, now: number): Promise<Notification[]> {
  if ((await getAccount(email))?.employerId) return [];
  return (await invitesFor(email)).reverse().map((invite) => ({
    id: `team-invite:${invite.id}`,
    type: "团队",
    title: `${invite.employerName} 邀请你加入团队`,
    detail: `加入后做${TEAM_ROLE_LABEL[invite.role]}，用雇主身份为这家店发职位、回复聊天。在「我的」里接受或婉拒。`,
    time: postedAgoZh(invite.createdAt, now),
    unread: true,
    target: { type: "team_invite" },
  }));
}
