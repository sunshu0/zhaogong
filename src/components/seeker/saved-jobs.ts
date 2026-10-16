// 收藏和进度 (#52, PRD R-28): the steps a saved job goes through, and which jobs the chat says were contacted.
// Pure, for the server and the page alike.
import type { ChatView } from "@/components/seeker/chat-store";

export const SAVED_STAGES = ["saved", "contacted", "interviewed", "hired", "rejected"] as const;
export type SavedStage = (typeof SAVED_STAGES)[number];

export const SAVED_STAGE_LABELS: Record<SavedStage, string> = {
  saved: "已收藏",
  contacted: "已联系",
  interviewed: "已面试",
  hired: "已录用",
  rejected: "没成",
};

export function parseSavedStage(value: unknown): SavedStage | undefined {
  return SAVED_STAGES.find((stage) => stage === value);
}

/**
 * The stage to show. One the user picked always wins; until then a job whose chat swapped contact details is
 * 已联系, any other 已收藏.
 */
export function effectiveStage(picked: SavedStage | null, contactedInChat: boolean): SavedStage {
  return picked ?? (contactedInChat ? "contacted" : "saved");
}

/** Jobs whose chat has a contact-details exchange both sides agreed to. */
export function jobsContactedInChat(view: Pick<ChatView, "conversations" | "exchanges">): Set<string> {
  const jobs = new Set<string>();
  for (const conversation of view.conversations) {
    if (!conversation.job) continue;
    const swapped = (view.exchanges[conversation.id] ?? []).some(
      (x) => x.kind === "contact" && x.status === "accepted",
    );
    if (swapped) jobs.add(conversation.job);
  }
  return jobs;
}

/** Where 收藏 sends a signed-out visitor: sign in, then back to this page, which finishes saving `jobId`. */
export function saveAfterSignInHref(path: string, jobId: string): string {
  const [pathname, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set(SAVE_PARAM, jobId);
  return `/login?next=${encodeURIComponent(`${pathname}?${params}`)}`;
}

/** The query parameter a page reads after sign-in to finish a save (saveAfterSignInHref). */
export const SAVE_PARAM = "save";

/**
 * 收藏 of an external job (#131) shares the buttons and the list with the job list's jobs: its key there is the
 * external job's id behind this prefix, which no job id has.
 */
const EXTERNAL_KEY = "external:";

export const externalSaveKey = (externalJobId: string) => `${EXTERNAL_KEY}${externalJobId}`;

/** The external job's id in a save key, or undefined for a job of the job list. */
export function externalIdOfSaveKey(key: string): string | undefined {
  return key.startsWith(EXTERNAL_KEY) ? key.slice(EXTERNAL_KEY.length) : undefined;
}
