"use server";

// 门店照片 for /admin (F8, ADR 0052): the shop photos waiting for a moderator, and approving one or sending it back
// with a reason. A moderator only (requireModerator, as every /admin Server Function); each decision goes into the
// log with who made it (#60). The picture itself comes from /api/company-photos/[id], which shows a waiting photo to a
// moderator only.
import { addModerationLog } from "@/lib/data";
import { isPhotoRejectReason, type PhotoRejectReason } from "@/lib/company-photos";
import { decidePhoto, listPendingPhotos, purgeExpiredPhotos } from "@/db/employer-photos";
import { describeAction } from "@/app/[lang]/admin/moderation";
import { refusedText, requireModerator } from "@/app/[lang]/admin/moderator";
import { pick } from "@/i18n/messages";
import { employerPhotosMessages } from "@/i18n/messages/employer-photos";
import { requestLang } from "@/i18n/server";
import type { AdminResult, Refused } from "@/app/[lang]/admin/actions";

export interface PhotoItem {
  id: string;
  employerId: string;
  employerName: string;
  uploadedAt: string;
}

/** The photos waiting for a moderator, oldest upload first. */
export async function getPhotoQueue(): Promise<PhotoItem[] | Refused> {
  const me = await requireModerator();
  if (!me.ok) return { refused: me.reason, error_zh: await refusedText(me.reason) };
  // Once a day, every business's photos past keeping go (review F8 rework 1); a failure only waits for next time.
  await purgeExpiredPhotos().catch((error: unknown) => console.error("company photos: cleanup failed", error));
  return listPendingPhotos();
}

async function decide(
  id: unknown,
  decision: { approve: true } | { approve: false; reason: PhotoRejectReason },
): Promise<AdminResult> {
  const me = await requireModerator();
  if (!me.ok) return { ok: false, error_zh: await refusedText(me.reason) };
  const lang = await requestLang();
  const t = pick(employerPhotosMessages, lang);
  if (typeof id !== "string") return { ok: false, error_zh: t.admin.gone };
  const decided = await decidePhoto(id, me.email, decision);
  if (!decided) return { ok: false, error_zh: t.admin.gone };
  const entry = await addModerationLog({
    action: decision.approve ? "photo_approve" : "photo_reject",
    employerId: decided.employerId,
    employerName: decided.employerName,
    note: decision.approve ? undefined : t.rejectReasons[decision.reason],
    moderator: me.email,
  });
  return { ok: true, text: describeAction(entry, lang) };
}

/** Approves a waiting photo: it shows on the business's public page. */
export async function approvePhoto(id: string): Promise<AdminResult> {
  return decide(id, { approve: true });
}

/** Sends a waiting photo back with one of the fixed reasons; its file is removed, the reason kept for the business. */
export async function rejectPhoto(id: string, reason: unknown): Promise<AdminResult> {
  const lang = await requestLang();
  if (!isPhotoRejectReason(reason)) return { ok: false, error_zh: pick(employerPhotosMessages, lang).admin.noReason };
  return decide(id, { approve: false, reason });
}
