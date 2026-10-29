// The employer identity's notifications about its shop photos (F8, ADR 0052): one for each photo a moderator sent
// back, newest decision first, while the business keeps its reason (REJECTED_KEEP_DAYS). Not a Server Function: it
// takes the email, so only server code that read the email from the session calls it
// (messages/server-notifications.ts). Server only.
import { getAccountEmployer } from "@/lib/data";
import { readOwnPhotos } from "@/db/employer-photos";
import { postedAgo } from "@/components/seeker/format";
import type { Notification } from "@/components/seeker/hub-state";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { employerPhotosMessages } from "@/i18n/messages/employer-photos";

export async function myPhotoNotifications(
  email: string,
  now: number,
  lang: Lang = DEFAULT_LANG,
): Promise<Notification[]> {
  const employer = await getAccountEmployer(email);
  if (!employer) return [];
  // Built when the hub is read, not when the moderator decided, so it is in the reader's language (ADR 0023).
  const { notifications: t, rejectReasons } = pick(employerPhotosMessages, lang);
  // Reading the hub writes nothing: tidying old rows and retrying files is listOwnPhotos's, on the photos page.
  return (await readOwnPhotos(employer.id, new Date(now)))
    .filter((photo) => photo.status === "rejected" && photo.reason && photo.reviewedAt)
    .sort((a, b) => b.reviewedAt!.localeCompare(a.reviewedAt!))
    .map((photo) => ({
      id: `photo:${photo.id}:rejected`,
      type: t.type,
      title: t.rejectedTitle,
      detail: t.rejectedDetail(rejectReasons[photo.reason!]),
      time: postedAgo(photo.reviewedAt!, now, lang),
      unread: true,
      target: { type: "photos" },
    }));
}
