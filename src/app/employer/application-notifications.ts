// The employer identity's notifications about applications (#84). Not a Server Function: it takes the email, so only
// server code that read the email from the session calls it (messages/server-notifications.ts). Server only.
import { getAccountEmployer, getJob } from "@/lib/data";
import { applicationsOfBusiness } from "@/db/job-applications";
import { postedAgoZh } from "@/components/seeker/format";
import { applicationNotificationId } from "@/components/seeker/applications";
import type { Notification } from "@/components/seeker/hub-state";

/** The business's latest applications, newest first; one it has already looked at counts as read. */
export async function myApplicationNotifications(email: string, now: number): Promise<Notification[]> {
  const employer = await getAccountEmployer(email);
  if (!employer) return [];
  const rows = await applicationsOfBusiness(employer.id);
  return Promise.all(
    rows.map(async (row): Promise<Notification> => {
      const job = await getJob(row.jobId);
      return {
        id: applicationNotificationId(row.id),
        type: "申请",
        title: `${row.profile.name}申请了${job?.titleZh ?? "你的职位"}`,
        detail: row.note ? `附言：${row.note}` : "点开看对方的资料",
        time: postedAgoZh(row.appliedAt, now),
        unread: !row.seenAt,
        target: { type: "applicants", jobId: row.jobId },
      };
    }),
  );
}
