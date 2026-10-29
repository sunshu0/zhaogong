"use server";

// 门店照片和福利 (ADR 0052): the business's shop photos and benefits, for its own team. Who acts comes from this
// browser's session cookie, the business from that account; only an admin uploads, deletes or changes benefits, and
// the database checks that again when it writes (db/employer-photos.ts).
import { randomUUID } from "node:crypto";
import { getCurrentSession } from "@/lib/auth";
import { getAccount, getEmployer } from "@/lib/data";
import { currentBan } from "@/lib/employer-ban";
import { getTeam } from "@/db/team";
import {
  addPhoto,
  forgetPhoto,
  getBenefits,
  listOwnPhotos,
  photoStillWanted,
  purgeExpiredPhotos,
  removeOwnPhoto,
  saveBenefits,
} from "@/db/employer-photos";
import { banNotice } from "@/components/employer/ban-notice";
import { employerCommonMessages } from "@/i18n/messages/employer-common";
import { photoStore } from "@/db/photo-store";
import { canEditPage } from "@/components/employer/employer-page";
import { scopeOf } from "@/lib/chat-server/identity";
import { isCutJpeg, sniffImage, stripMetadata } from "@/lib/image-metadata";
import { PHOTO_BYTES_MAX, PHOTO_TYPES, parseBenefits, type Benefit, type OwnPhoto } from "@/lib/company-photos";
import { pick } from "@/i18n/messages";
import { employerPhotosMessages } from "@/i18n/messages/employer-photos";
import { requestLang } from "@/i18n/server";

/**
 * The business's photos and benefits as its team sees them; `canEdit` whether this person may change them. `banned`:
 * the business is banned (a temporary ban too, ADR 0044), what its team reads instead of the tools; nothing changes.
 */
export type CompanyPhotosSnapshot = {
  scope: string;
  employerId: string;
  photos: OwnPhoto[];
  benefits: Benefit[];
  canEdit: boolean;
  banned?: string;
};

/** What a change answers: the snapshot after it, and a sentence to say (`error` when nothing changed). */
export type CompanyPhotosResult = { snapshot: CompanyPhotosSnapshot; said: string; error?: true };

/** The signed-in employer's business, banned or not (getAccountEmployer leaves a banned one out). */
async function myBusiness() {
  const session = await getCurrentSession();
  if (!session || session.activeRole !== "employer") return null;
  const linked = (await getAccount(session.email))?.employerId;
  const employer = linked ? currentBan(await getEmployer(linked), Date.now()) : undefined;
  return employer ? { session, employer } : null;
}

type Mine = NonNullable<Awaited<ReturnType<typeof myBusiness>>>;

/** What the team reads when the business is banned, the same words as on its other pages; undefined if it is not. */
async function banned(mine: Mine): Promise<string | undefined> {
  const lang = await requestLang();
  return banNotice(mine.employer, lang, pick(employerCommonMessages, lang).errors.banned);
}

/** A banned business changes nothing here: the answer says why, as its other pages do. */
async function refusedIfBanned(mine: Mine): Promise<CompanyPhotosResult | undefined> {
  const ban = await banned(mine);
  return ban ? { snapshot: await snapshot(mine), said: ban, error: true } : undefined;
}

async function snapshot(mine: Mine): Promise<CompanyPhotosSnapshot> {
  const [photos, benefits, members, ban] = await Promise.all([
    listOwnPhotos(mine.employer.id),
    getBenefits(mine.employer.id),
    getTeam(mine.employer.id),
    banned(mine),
  ]);
  const me = members.find((m) => m.email === mine.session.email);
  return {
    scope: scopeOf(mine.session),
    employerId: mine.employer.id,
    photos,
    benefits,
    canEdit: !ban && canEditPage(me?.role),
    ...(ban ? { banned: ban } : {}),
  };
}

/** Null when signed out, signed in as a job seeker, or without a business. */
export async function myCompanyPhotos(): Promise<CompanyPhotosSnapshot | null> {
  const mine = await myBusiness();
  return mine ? snapshot(mine) : null;
}

/**
 * One photo from the upload form (field `photo`), already made smaller by the browser: judged by its bytes, its
 * metadata (where it was taken) removed here whatever the browser did, then counted and stored. Null when there is
 * no business signed in.
 */
export async function uploadCompanyPhoto(form: FormData): Promise<CompanyPhotosResult | null> {
  const mine = await myBusiness();
  if (!mine) return null;
  const refused = await refusedIfBanned(mine);
  if (refused) return refused;
  const t = pick(employerPhotosMessages, await requestLang()).photos;
  const refuse = async (said: string): Promise<CompanyPhotosResult> => ({
    snapshot: await snapshot(mine),
    said,
    error: true,
  });
  const file = form.get("photo");
  if (!(file instanceof File)) return refuse(t.notImage);
  if (file.size > PHOTO_BYTES_MAX) return refuse(t.tooBig);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImage(bytes);
  const clean = type && (PHOTO_TYPES as readonly string[]).includes(type) ? stripMetadata(bytes, type) : undefined;
  if (!type || !clean) return refuse(isCutJpeg(bytes) ? t.cutImage : t.notImage);
  // Once a day, every business's photos past keeping go (review F8 rework 1); a failure only waits for next time.
  await purgeExpiredPhotos().catch((error: unknown) => console.error("company photos: cleanup failed", error));
  const id = randomUUID();
  const added = await addPhoto(mine.session.email, { id, type, bytes: clean.length });
  if (added === "no_business") return null;
  if (added === "banned") return refuse((await banned(mine)) ?? t.failed);
  if (added !== "added") return refuse({ not_admin: t.notAdmin, full: t.full, too_many: t.tooMany }[added]);
  try {
    await photoStore().put(id, clean, type);
  } catch (error) {
    await forgetPhoto(id);
    console.error("company photo: not stored", id, error);
    return refuse(t.failed);
  }
  // The row may have gone while the file was on its way (the account or business deleted): no file without a row.
  if (!(await photoStillWanted(id))) {
    await photoStore()
      .remove([id])
      .catch((error: unknown) => console.error("company photo: file of a row already gone not removed", id, error));
    return refuse(t.failed);
  }
  return { snapshot: await snapshot(mine), said: t.uploaded };
}

/** Deletes one of the business's photos (any status) with its file. Null when there is no business signed in. */
export async function removeCompanyPhoto(id: string): Promise<CompanyPhotosResult | null> {
  const mine = await myBusiness();
  if (!mine) return null;
  const t = pick(employerPhotosMessages, await requestLang()).photos;
  const refused = await refusedIfBanned(mine);
  if (refused) return refused;
  const removed = await removeOwnPhoto(mine.session.email, String(id));
  if (removed === "not_admin") return { snapshot: await snapshot(mine), said: t.notAdmin, error: true };
  return { snapshot: await snapshot(mine), said: t.removed };
}

/** Saves the benefits ticked (known ones only). Null when there is no business signed in or it is not a list. */
export async function saveCompanyBenefits(benefits: unknown): Promise<CompanyPhotosResult | null> {
  const mine = await myBusiness();
  const picked = parseBenefits(benefits);
  if (!mine || !picked) return null;
  const refused = await refusedIfBanned(mine);
  if (refused) return refused;
  const t = pick(employerPhotosMessages, await requestLang());
  const saved = await saveBenefits(mine.session.email, picked);
  if (saved === "no_business") return null;
  if (saved === "not_admin") return { snapshot: await snapshot(mine), said: t.photos.notAdmin, error: true };
  return { snapshot: await snapshot(mine), said: t.benefits.saved };
}
