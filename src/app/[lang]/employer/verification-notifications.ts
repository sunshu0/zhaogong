// The employer identity's notifications about its 企业验证 applications (#78): one when a moderator approves or
// rejects one, newest first. Not a Server Function: it takes the email, so only server code that read the email from
// the session calls it (messages/server-notifications.ts). Server only.
import { getAccountEmployer } from "@/lib/data";
import { listVerifications } from "@/db/verification-requests";
import { kindLabels, rejectReasons } from "@/components/employer/verification";
import { postedAgo } from "@/components/seeker/format";
import type { Notification } from "@/components/seeker/hub-state";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { employerVerifyMessages } from "@/i18n/messages/employer-verify";

export async function myVerificationNotifications(
  email: string,
  now: number,
  lang: Lang = DEFAULT_LANG,
): Promise<Notification[]> {
  const employer = await getAccountEmployer(email);
  if (!employer) return [];
  // Built when the hub is read, not when the moderator decided, so it is in the reader's language (ADR 0023).
  const t = pick(employerVerifyMessages, lang).notifications;
  const kinds = kindLabels(lang);
  const reasons = rejectReasons(lang);
  return (await listVerifications(employer.id))
    .filter((r) => (r.status === "approved" || r.status === "rejected") && r.decidedAt)
    .reverse()
    .map((r) => ({
      id: `verification:${r.id}:${r.status}`,
      type: t.type,
      title: r.status === "approved" ? t.approvedTitle(kinds[r.kind]) : t.rejectedTitle,
      detail:
        r.status === "approved"
          ? t.approvedDetail(kinds[r.kind])
          : t.rejectedDetail(reasons[r.rejectReason!], r.rejectNote?.replace(/[。.]$/, "") ?? ""),
      time: postedAgo(r.decidedAt!, now, lang),
      unread: true,
      target: { type: "verification" },
    }));
}
