// 企业主页 shop photos and benefits (ADR 0052): the limits the upload page and the server share, the fixed list of
// benefits, and the reasons a moderator gives when sending a photo back. Pure; the words are in
// i18n/messages/employer-photos.ts.
import type { ImageType } from "@/lib/image-metadata";

/** The most photos a business has, waiting and approved together. */
export const PHOTOS_MAX = 6;
/** How big each may be after the browser made it smaller (the server checks again), and which kinds, by their bytes. */
export const PHOTO_BYTES_MAX = 2 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const satisfies readonly ImageType[];
/** The browser makes the longer side at most this many pixels before sending (review F8 设计 §3). */
export const PHOTO_EDGE_MAX = 1600;
/** Uploads per business per day: a photo sent back frees its place, so without a cap the queue could be flooded. */
export const PHOTO_UPLOADS_PER_DAY = 20;
/** A photo sent back keeps its reason (not the picture) this many days, for the business to read. */
export const REJECTED_KEEP_DAYS = 30;
/** Seconds a browser may keep an approved photo: a photo taken down stops showing within this (review F8 §1). */
export const PHOTO_CACHE_SECONDS = 600;

export type PhotoStatus = "pending" | "approved" | "rejected";
/** A row may also be `removed`: deleted by the business, kept a day so it still counts as that day's upload. */
export type PhotoRowStatus = PhotoStatus | "removed";

/** Why a moderator sends a photo back. Contact details belong in chat only (ADR 0002). */
export const PHOTO_REJECT_REASONS = ["contact", "faces", "unrelated", "unclear", "inappropriate"] as const;
export type PhotoRejectReason = (typeof PHOTO_REJECT_REASONS)[number];

export const isPhotoRejectReason = (value: unknown): value is PhotoRejectReason =>
  (PHOTO_REJECT_REASONS as readonly unknown[]).includes(value);

/** Benefits a business may show, beyond what the law already gives everyone (no paid leave or KiwiSaver here). */
export const BENEFITS = [
  "meals",
  "housing",
  "tips",
  "staff_discount",
  "paid_training",
  "flexible_shifts",
  "transport",
  "bonus",
] as const;
export type Benefit = (typeof BENEFITS)[number];

/** The benefits a browser sent: known ones only, each once, in the list's order; undefined if it is not a list. */
export function parseBenefits(value: unknown): Benefit[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const picked = new Set(value);
  return BENEFITS.filter((benefit) => picked.has(benefit));
}

/** A photo as the business's own page lists it. */
export interface OwnPhoto {
  id: string;
  status: PhotoStatus;
  reason: PhotoRejectReason | null;
  uploadedAt: string;
  reviewedAt: string | null;
}

/** Photo ids are the store's keys' own format (crypto.randomUUID), so a route can refuse anything else at once. */
export const PHOTO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
