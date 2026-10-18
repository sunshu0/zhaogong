// 编辑职位, 重新发布 and 复制为新职位 keep their unsaved form in this tab (#193), like the posting page (#178): a reload
// or a form that failed does not lose the changes. One entry per page and job; sessionStorage, so it stays in this
// tab; only for the account that wrote it, and for a day. Nothing is kept while the form is as the job was.
import type { PostForm } from "@/components/employer/post-form";

export type JobDraftKind = "edit" | "republish" | "copy";

export const jobDraftKey = (kind: JobDraftKind, jobId: string) => `zg-job-draft:${kind}:${jobId}`;
const VERSION = 1;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface SavedJobForm {
  email: string;
  form: PostForm;
  englishByHand: boolean;
}

type Stored = SavedJobForm & { v: number; savedAt: number };
type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Keeps the form, or clears the entry when it is still the job as it was (`original`). */
export function saveJobForm(
  storage: DraftStorage,
  kind: JobDraftKind,
  jobId: string,
  saved: SavedJobForm,
  original: PostForm,
  now = Date.now(),
) {
  if (JSON.stringify(saved.form) === JSON.stringify(original)) return clearJobForm(storage, kind, jobId);
  const stored: Stored = { ...saved, v: VERSION, savedAt: now };
  try {
    storage.setItem(jobDraftKey(kind, jobId), JSON.stringify(stored));
  } catch {
    // Full or blocked storage: the page works as before, without the safety net.
  }
}

/** The form this account left for this page and job within a day, or undefined; anything else found is cleared. */
export function loadJobForm(
  storage: DraftStorage,
  kind: JobDraftKind,
  jobId: string,
  email: string,
  now = Date.now(),
): SavedJobForm | undefined {
  let stored: Partial<Stored> | null;
  try {
    stored = JSON.parse(storage.getItem(jobDraftKey(kind, jobId)) ?? "null");
  } catch {
    stored = {};
  }
  if (!stored) return undefined;
  const fresh = typeof stored.savedAt === "number" && stored.savedAt <= now && now - stored.savedAt <= MAX_AGE_MS;
  const shaped = stored.v === VERSION && typeof stored.form?.titleZh === "string";
  if (!fresh || !shaped || stored.email !== email) {
    clearJobForm(storage, kind, jobId);
    return undefined;
  }
  return { email: stored.email, form: stored.form!, englishByHand: stored.englishByHand === true };
}

export function clearJobForm(storage: DraftStorage, kind: JobDraftKind, jobId: string) {
  try {
    storage.removeItem(jobDraftKey(kind, jobId));
  } catch {
    // As in saveJobForm.
  }
}
