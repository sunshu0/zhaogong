// 举报附证据 (ADR 0027): the limits the job report form and the server share, and what a picked message is.
import type { AccountRole } from "@/lib/types";

/** The most chat messages one report carries. */
export const EVIDENCE_MESSAGES_MAX = 20;
/** How many of the newest messages the form lists to choose from. */
export const PICKABLE_MESSAGES_MAX = 200;
/** The most screenshots one report carries, how big each may be, and which kinds (judged by their bytes). */
export const EVIDENCE_IMAGES_MAX = 3;
export const EVIDENCE_IMAGE_BYTES_MAX = 5 * 1024 * 1024;
export const EVIDENCE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
/** Evidence goes this many days after its report is handled; the report stays. */
export const EVIDENCE_KEEP_DAYS = 180;

/** A message the reporter may attach: one of their own chats with the job's business, as the form lists it. */
export interface PickableMessage {
  id: number;
  /** The reporter sent it; otherwise the business did. */
  mine: boolean;
  /** Who in the business's team sent it, when they did. */
  byName: string | null;
  text: string;
  sentAt: string;
  /** The job the chat is about (it may be another of the business's jobs). */
  jobTitle: string;
}

/** A message as a report keeps it: copied when reported, so it reads the same if the chat goes later. */
export interface EvidenceMessage {
  messageId: number;
  from: AccountRole;
  byName: string | null;
  text: string;
  sentAt: string;
}

/** A screenshot as a report keeps it: its key in the evidence store, its type and size after the metadata went. */
export interface EvidenceImage {
  key: string;
  type: (typeof EVIDENCE_IMAGE_TYPES)[number];
  bytes: number;
}

/** The message ids a report sends: up to EVIDENCE_MESSAGES_MAX different whole numbers, or undefined. */
export function parseEvidenceIds(value: unknown): number[] | undefined {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every((id) => Number.isSafeInteger(id) && id > 0)) return undefined;
  const ids = [...new Set(value as number[])];
  return ids.length <= EVIDENCE_MESSAGES_MAX ? ids : undefined;
}
