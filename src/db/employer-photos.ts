// 企业主页 shop photos and benefits on the server (ADR 0052). A business's admin uploads up to PHOTOS_MAX photos, each
// waiting for a moderator; approved ones show on the public page, a photo sent back loses its file at once and keeps
// its reason REJECTED_KEEP_DAYS (no scheduled job, ADR 0008: listing the business's photos deletes what is too old and
// retries files a store did not remove). Who may write is checked again in the statement that writes (ADR 0031). The
// files are in the photo store (photo-store.ts) under the row's id. Server only.
import { and, asc, count, eq, gt, gte, inArray, lt, ne, or, sql } from "drizzle-orm";
import { database } from "@/db/ready";
import { inList } from "@/db/in-list";
import { CHANGED, keptChanging, untilSettled } from "@/db/optimistic";
import { photoStore } from "@/db/photo-store";
import * as t from "@/db/schema";
import { insertIf } from "@/db/write-if";
import { nzDay } from "@/db/job-stats";
import { normalizeEmail } from "@/components/seeker/session";
import { canEditPage } from "@/components/employer/employer-page";
import { isBanned } from "@/lib/employer-ban";
import {
  PHOTO_UPLOADS_PER_DAY,
  PHOTOS_MAX,
  REJECTED_KEEP_DAYS,
  parseBenefits,
  type Benefit,
  type OwnPhoto,
  type PHOTO_TYPES,
  type PhotoRejectReason,
  type PhotoRowStatus,
  type PhotoStatus,
} from "@/lib/company-photos";

const DAY_MS = 86_400_000;
const p = t.employerPhotos;

/** Photos that take one of the business's PHOTOS_MAX places: waiting and approved. */
const SHOWN: PhotoStatus[] = ["pending", "approved"];

/** SQL: `address` is still an admin of `employerId` (an account from before teams counts as one, #87). */
const isAdminSql = (address: string, employerId: string) =>
  sql`exists (select 1 from ${t.accounts} where ${t.accounts.email} = ${address} and ${t.accounts.employerId} = ${employerId} and coalesce(${t.accounts.teamRole}, 'admin') = 'admin')`;

/** SQL: `employerId` is not banned at `at` (a temporary ban counts while it runs, ADR 0044). */
const notBannedSql = (employerId: string, at: string) =>
  sql`not exists (select 1 from ${t.employers} where ${t.employers.id} = ${employerId} and ${t.employers.bannedAt} is not null and (${t.employers.bannedUntil} is null or ${t.employers.bannedUntil} > ${at}))`;

/** The account's business, if it is an admin of it; or why it may not change the business's photos and benefits. */
async function adminBusiness(address: string): Promise<{ employerId: string } | "no_business" | "not_admin"> {
  const db = await database();
  const [account] = await db.select().from(t.accounts).where(eq(t.accounts.email, address));
  if (!account?.employerId) return "no_business";
  if (!canEditPage(account.teamRole ?? "admin")) return "not_admin";
  return { employerId: account.employerId };
}

/** The most keys one R2 delete takes. */
export const REMOVE_BATCH = 1000;

/** Rows that are only kept for a while: sent back (their reason) or deleted by the business (their upload, counted). */
const GONE: PhotoRowStatus[] = ["rejected", "removed"];

/** SQL: the row is one the business may still see — waiting, approved, or sent back within REJECTED_KEEP_DAYS. */
const visibleSql = (now: Date) =>
  and(ne(p.status, "removed"), or(ne(p.status, "rejected"), gte(p.reviewedAt, rejectedCutoff(now))))!;
const rejectedCutoff = (now: Date) => new Date(now.getTime() - REJECTED_KEEP_DAYS * DAY_MS).toISOString();

/**
 * Removes the files of photos sent back or deleted whose removal failed before (stored still 1), marking each row
 * once its file is gone; then deletes the rows past keeping: sent back more than REJECTED_KEEP_DAYS ago, or deleted
 * and uploaded more than a day ago (a day's uploads are counted from the rows, so a deleted one keeps its row that
 * long). Only rows whose file is gone are deleted. `scope` narrows it to one business. False if a store did not answer
 * (reported in the server log; the files are tried again next time).
 */
async function tidyPhotos(now: Date, scope?: string): Promise<boolean> {
  const db = await database();
  const mine = scope ? eq(p.employerId, scope) : undefined;
  const rows = await db
    .select({ id: p.id })
    .from(p)
    .where(and(mine, inArray(p.status, GONE), eq(p.stored, 1)));
  let answered = true;
  const ids = rows.map((row) => row.id);
  // R2 deletes at most REMOVE_BATCH keys at once; a batch that fails waits for next time, the others go on.
  for (let i = 0; i < ids.length; i += REMOVE_BATCH) {
    const batch = ids.slice(i, i + REMOVE_BATCH);
    try {
      await photoStore().remove(batch);
      await db.update(p).set({ stored: 0 }).where(inList(p.id, batch));
    } catch (error) {
      console.error("company photos: files not removed, tried again next time", batch, error);
      answered = false;
    }
  }
  const dayAgo = new Date(now.getTime() - DAY_MS).toISOString();
  await db
    .delete(p)
    .where(
      and(
        mine,
        eq(p.stored, 0),
        or(
          and(eq(p.status, "rejected"), lt(p.reviewedAt, rejectedCutoff(now))),
          and(eq(p.status, "removed"), lt(p.uploadedAt, dayAgo)),
        ),
      ),
    );
  return answered;
}

let tidiedDay: string | undefined;

/**
 * Keeps every business's photos to what the privacy page says (review F8 rework 1): files of photos sent back or
 * deleted that a store did not remove go, and rows past keeping go, once per New Zealand day — the first upload of
 * the day or the first time a moderator opens the queue calls it (no scheduled job, ADR 0008), as
 * purgeExpiredEvidence does. After a store did not answer, the next call runs again whatever the day.
 */
export async function purgeExpiredPhotos(now = new Date()): Promise<void> {
  const day = nzDay(now);
  if (tidiedDay === day) return;
  tidiedDay = day;
  try {
    if (!(await tidyPhotos(now))) tidiedDay = undefined;
  } catch (error) {
    tidiedDay = undefined;
    throw error;
  }
}

/** For tests: the next purgeExpiredPhotos call runs whatever the day. */
export function resetPhotoCleanupForTests(): void {
  tidiedDay = undefined;
}

/**
 * The business's photos, oldest upload first: waiting, approved, and those sent back within REJECTED_KEEP_DAYS (their
 * reason, no picture). On the way, the business's own rows past keeping are deleted and files a store did not remove
 * are tried again (purgeExpiredPhotos does the same for every business).
 */
export async function listOwnPhotos(employerId: string, now = new Date()): Promise<OwnPhoto[]> {
  await tidyPhotos(now, employerId);
  return readOwnPhotos(employerId, now);
}

/** The same photos as listOwnPhotos, writing nothing: for reading notifications (review F8 §2). */
export async function readOwnPhotos(employerId: string, now = new Date()): Promise<OwnPhoto[]> {
  const db = await database();
  const rows = await db
    .select()
    .from(p)
    .where(and(eq(p.employerId, employerId), visibleSql(now)))
    .orderBy(asc(p.uploadedAt), asc(p.id));
  return rows.map((row) => ({
    id: row.id,
    // visibleSql leaves out deleted rows.
    status: row.status as PhotoStatus,
    reason: row.rejectReason ?? null,
    uploadedAt: row.uploadedAt,
    reviewedAt: row.reviewedAt,
  }));
}

/** The ids of the business's approved photos, oldest upload first, for its public page. */
export async function listApprovedPhotoIds(employerId: string): Promise<string[]> {
  const db = await database();
  const rows = await db
    .select({ id: p.id })
    .from(p)
    .where(and(eq(p.employerId, employerId), eq(p.status, "approved")))
    .orderBy(asc(p.uploadedAt), asc(p.id));
  return rows.map((row) => row.id);
}

export type AddPhotoResult = "added" | "no_business" | "not_admin" | "banned" | "full" | "too_many";

/**
 * Takes a place for a new photo of the account's business, waiting for a moderator, before its file is stored (the
 * caller puts the file under `photo.id`, and forgetPhoto's the row if that fails). Only an admin may, of a business
 * not banned (a temporary ban too, ADR 0044); the business must have fewer than PHOTOS_MAX waiting and approved, and
 * fewer than PHOTO_UPLOADS_PER_DAY uploads in the last 24 hours whatever became of them (a photo sent back or deleted
 * frees its place, not its upload: its row stays a day, tidyPhotos). All of it checked again in the statement that
 * inserts (ADR 0031), so uploads sent at once cannot all pass.
 */
export async function addPhoto(
  email: string,
  photo: { id: string; type: (typeof PHOTO_TYPES)[number]; bytes: number },
  now = new Date(),
): Promise<AddPhotoResult> {
  const address = normalizeEmail(email);
  const uploadedAt = now.toISOString();
  const dayAgo = new Date(now.getTime() - DAY_MS).toISOString();
  const db = await database();
  return untilSettled<AddPhotoResult>(
    async () => {
      const business = await adminBusiness(address);
      if (typeof business === "string") return business;
      const { employerId } = business;
      const [employer] = await db
        .select({ bannedAt: t.employers.bannedAt, bannedUntil: t.employers.bannedUntil })
        .from(t.employers)
        .where(eq(t.employers.id, employerId));
      if (
        employer &&
        isBanned(
          { bannedAt: employer.bannedAt ?? undefined, bannedUntil: employer.bannedUntil ?? undefined },
          now.getTime(),
        )
      )
        return "banned";
      const [{ shown }] = await db
        .select({ shown: count() })
        .from(p)
        .where(and(eq(p.employerId, employerId), inArray(p.status, SHOWN)));
      if (shown >= PHOTOS_MAX) return "full";
      const [{ today }] = await db
        .select({ today: count() })
        .from(p)
        .where(and(eq(p.employerId, employerId), gt(p.uploadedAt, dayAgo)));
      if (today >= PHOTO_UPLOADS_PER_DAY) return "too_many";
      const [row] = await insertIf(
        db,
        p,
        { ...photo, employerId, status: "pending", stored: 1, uploadedByEmail: address, uploadedAt },
        sql`${isAdminSql(address, employerId)}
          and ${notBannedSql(employerId, uploadedAt)}
          and (select count(*) from ${p} where ${p.employerId} = ${employerId} and ${p.status} in ('pending', 'approved')) < ${PHOTOS_MAX}
          and (select count(*) from ${p} where ${p.employerId} = ${employerId} and ${p.uploadedAt} > ${dayAgo}) < ${PHOTO_UPLOADS_PER_DAY}`,
      ).returning({ id: p.id });
      return row ? "added" : CHANGED;
    },
    () => keptChanging("addPhoto"),
  );
}

/** Deletes a photo's row whose file could not be stored, so it takes no place. */
export async function forgetPhoto(id: string): Promise<void> {
  const db = await database();
  await db.delete(p).where(eq(p.id, id));
}

/**
 * Deletes one of the business's photos, whatever its status: only an admin of the photo's business may, checked in
 * the statement that writes. The row becomes `removed` first, so nobody can be shown it; then its file goes, and the
 * row is marked once it has. The row itself stays a day, so it still counts against PHOTO_UPLOADS_PER_DAY (otherwise
 * upload, delete, upload again would have no limit, review F8 rework 1); tidyPhotos deletes it after that, and tries
 * again a file the store did not remove.
 */
export async function removeOwnPhoto(email: string, id: string): Promise<"removed" | "not_found" | "not_admin"> {
  const address = normalizeEmail(email);
  const db = await database();
  const removed = await untilSettled<{ stored: number } | "not_found" | "not_admin">(
    async () => {
      const [photo] = await db.select().from(p).where(eq(p.id, id));
      const [account] = await db.select().from(t.accounts).where(eq(t.accounts.email, address));
      // Another business's photo is not found, whatever this account's role in its own; one already deleted too.
      if (!photo || photo.status === "removed" || !account || account.employerId !== photo.employerId)
        return "not_found";
      if (!canEditPage(account.teamRole ?? "admin")) return "not_admin";
      const [row] = await db
        .update(p)
        .set({ status: "removed" })
        .where(
          and(
            eq(p.id, id),
            eq(p.employerId, photo.employerId),
            ne(p.status, "removed"),
            isAdminSql(address, photo.employerId),
          ),
        )
        .returning({ stored: p.stored });
      return row ?? CHANGED;
    },
    () => keptChanging("removeOwnPhoto"),
  );
  if (typeof removed === "string") return removed;
  if (
    removed.stored &&
    (await removeFile(id, "company photos: file of a deleted photo not removed, tried again later"))
  )
    await db.update(p).set({ stored: 0 }).where(eq(p.id, id));
  return "removed";
}

/** Whether the photo's row is still there and not deleted: checked after its file was stored (review F8 rework 1). */
export async function photoStillWanted(id: string): Promise<boolean> {
  const db = await database();
  const [row] = await db
    .select({ id: p.id })
    .from(p)
    .where(and(eq(p.id, id), ne(p.status, "removed")));
  return Boolean(row);
}

/** Removes one photo's file, reporting a store that did not answer in the server log; true if it went. */
async function removeFile(id: string, message: string): Promise<boolean> {
  try {
    await photoStore().remove([id]);
    return true;
  } catch (error) {
    console.error(message, id, error);
    return false;
  }
}

/**
 * The photo /api/company-photos/[id] may hand out: one whose file is stored, waiting or approved, with its business
 * and whether that business is banned at `now` (a temporary ban counts while it runs, ADR 0044). The route decides
 * who sees it.
 */
export async function findServablePhoto(
  id: string,
  now = new Date(),
): Promise<{ employerId: string; type: string; status: PhotoStatus; employerBanned: boolean } | undefined> {
  const db = await database();
  const [row] = await db
    .select({
      employerId: p.employerId,
      type: p.type,
      status: p.status,
      bannedAt: t.employers.bannedAt,
      bannedUntil: t.employers.bannedUntil,
    })
    .from(p)
    .innerJoin(t.employers, eq(t.employers.id, p.employerId))
    .where(and(eq(p.id, id), eq(p.stored, 1), inArray(p.status, SHOWN)));
  if (!row) return undefined;
  const { bannedAt, bannedUntil, ...photo } = row;
  return {
    ...photo,
    status: photo.status as PhotoStatus, // SHOWN only
    employerBanned: isBanned({ bannedAt: bannedAt ?? undefined, bannedUntil: bannedUntil ?? undefined }, now.getTime()),
  };
}

/** Photos waiting for a moderator, oldest upload first, with their business's name, for /admin. */
export async function listPendingPhotos(): Promise<
  { id: string; employerId: string; employerName: string; uploadedAt: string }[]
> {
  const db = await database();
  return db
    .select({ id: p.id, employerId: p.employerId, employerName: t.employers.name, uploadedAt: p.uploadedAt })
    .from(p)
    .innerJoin(t.employers, eq(t.employers.id, p.employerId))
    .where(eq(p.status, "pending"))
    .orderBy(asc(p.uploadedAt), asc(p.id));
}

/**
 * A moderator approves a waiting photo or sends it back with a reason; undefined if it is no longer waiting (decided
 * by another, or deleted). Sending back records the decision first and then removes the file, marking the row once it
 * is gone; a store that does not answer leaves stored at 1, and listOwnPhotos tries again (review F8 §2). The caller
 * checks the moderator and writes the moderation log.
 */
export async function decidePhoto(
  id: string,
  moderatorEmail: string,
  decision: { approve: true } | { approve: false; reason: PhotoRejectReason },
  now = new Date(),
): Promise<{ employerId: string; employerName: string } | undefined> {
  const db = await database();
  const [row] = await db
    .update(p)
    .set({
      status: decision.approve ? "approved" : "rejected",
      rejectReason: decision.approve ? null : decision.reason,
      reviewedByEmail: normalizeEmail(moderatorEmail),
      reviewedAt: now.toISOString(),
    })
    .where(and(eq(p.id, id), eq(p.status, "pending")))
    .returning({ employerId: p.employerId });
  if (!row) return undefined;
  if (!decision.approve && (await removeFile(id, "company photos: rejected file not removed, tried again later")))
    await db.update(p).set({ stored: 0 }).where(eq(p.id, id));
  const [employer] = await db
    .select({ name: t.employers.name })
    .from(t.employers)
    .where(eq(t.employers.id, row.employerId));
  return { employerId: row.employerId, employerName: employer?.name ?? "" };
}

/** The ids of the business's photos whose files may be in the store, for removing them with the business. */
export async function photoIdsOfBusiness(employerId: string): Promise<string[]> {
  const db = await database();
  const rows = await db
    .select({ id: p.id })
    .from(p)
    .where(and(eq(p.employerId, employerId), eq(p.stored, 1)));
  return rows.map((row) => row.id);
}

/** The business's photos for 导出我的数据: which, their status and times, never the picture. */
export async function listPhotosForExport(
  employerId: string,
  now = new Date(),
): Promise<{ id: string; status: PhotoStatus; uploadedAt: string; reviewedAt: string | null }[]> {
  const db = await database();
  // The photos the business sees (readOwnPhotos): not deleted ones, nor ones sent back past REJECTED_KEEP_DAYS.
  const rows = await db
    .select({ id: p.id, status: p.status, uploadedAt: p.uploadedAt, reviewedAt: p.reviewedAt })
    .from(p)
    .where(and(eq(p.employerId, employerId), visibleSql(now)))
    .orderBy(asc(p.uploadedAt), asc(p.id));
  return rows.map((row) => ({ ...row, status: row.status as PhotoStatus }));
}

/** The benefits the business shows, in BENEFITS' order; none when it has not picked any. */
export async function getBenefits(employerId: string): Promise<Benefit[]> {
  const db = await database();
  const [row] = await db
    .select({ benefits: t.employerProfiles.benefits })
    .from(t.employerProfiles)
    .where(eq(t.employerProfiles.employerId, employerId));
  return parseBenefits(row?.benefits) ?? [];
}

/**
 * Replaces the benefits of the account's business with these (known ones only, in BENEFITS' order). Only an admin
 * may, checked again in the statement that writes; a business without a 企业主页 yet gets an empty one.
 */
export async function saveBenefits(
  email: string,
  benefits: Benefit[],
  now = new Date(),
): Promise<Benefit[] | "no_business" | "not_admin"> {
  const address = normalizeEmail(email);
  const picked = parseBenefits(benefits) ?? [];
  const updatedAt = now.toISOString();
  const db = await database();
  return untilSettled(
    async () => {
      const business = await adminBusiness(address);
      if (typeof business === "string") return business;
      const [row] = await insertIf(
        db,
        t.employerProfiles,
        { employerId: business.employerId, page: {}, benefits: picked, updatedAt, updatedByEmail: address },
        isAdminSql(address, business.employerId),
      )
        .onConflictDoUpdate({
          target: t.employerProfiles.employerId,
          set: { benefits: picked, updatedAt, updatedByEmail: address },
        })
        .returning({ benefits: t.employerProfiles.benefits });
      return row ? (row.benefits ?? []) : CHANGED;
    },
    () => keptChanging("saveBenefits"),
  );
}
