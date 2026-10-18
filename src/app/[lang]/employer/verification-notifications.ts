// The employer identity's notifications about its 企业验证 applications (#78): one when a moderator approves or
// rejects one, newest first. Not a Server Function: it takes the email, so only server code that read the email from
// the session calls it (messages/server-notifications.ts). Server only.
import { getAccountEmployer } from "@/lib/data";
import { listVerifications } from "@/db/verification-requests";
import { KIND_LABELS, REJECT_REASONS } from "@/components/employer/verification";
import { postedAgoZh } from "@/components/seeker/format";
import type { Notification } from "@/components/seeker/hub-state";

export async function myVerificationNotifications(email: string, now: number): Promise<Notification[]> {
  const employer = await getAccountEmployer(email);
  if (!employer) return [];
  return (await listVerifications(employer.id))
    .filter((r) => (r.status === "approved" || r.status === "rejected") && r.decidedAt)
    .reverse()
    .map((r) => ({
      id: `verification:${r.id}:${r.status}`,
      type: "验证",
      title: r.status === "approved" ? `企业验证已通过：${KIND_LABELS[r.kind]}` : "企业验证没有通过",
      detail:
        r.status === "approved"
          ? `你的职位会显示「${KIND_LABELS[r.kind]}」和登记的公司名。`
          : `${REJECT_REASONS[r.rejectReason!]}：${r.rejectNote?.replace(/[。.]$/, "")}。改好资料可以重新提交。`,
      time: postedAgoZh(r.decidedAt!, now),
      unread: true,
      target: { type: "verification" },
    }));
}
