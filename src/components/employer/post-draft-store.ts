// The posting page's draft kept in this tab (#178): the chat, the pasted message and the form, so a reload or a page
// that failed does not lose what the employer has written. sessionStorage, so it stays in this tab and goes when the
// tab closes; only for the account that wrote it, and for a day. Cleared on publishing and on 再发一条.
import type { ChatState } from "@/lib/ai-post";
import type { PostForm } from "@/components/employer/post-form";

export const POST_DRAFT_KEY = "zg-post-draft";
const VERSION = 1;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** The steps a draft can be resumed at; a published job is not a draft. */
export type DraftStep = "chat" | "paste" | "form" | "preview";

export interface SavedPost {
  email: string;
  mode: "chat" | "form";
  step: DraftStep;
  chat: ChatState;
  text: string;
  form: PostForm;
  englishByHand: boolean;
  notes: string[];
}

type Stored = SavedPost & { v: number; savedAt: number };

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Whether there is anything worth keeping: a chat past the greeting, a pasted message or a form with a title. */
export function worthKeeping(post: Pick<SavedPost, "chat" | "text" | "form">): boolean {
  return post.chat.messages.length > 1 || post.text.trim() !== "" || post.form.titleZh.trim() !== "";
}

/** Keeps the draft (or clears it when there is nothing in it). Who posts is the server's to say, so it is not kept. */
export function savePost(storage: DraftStorage, post: SavedPost, now = Date.now()) {
  if (!worthKeeping(post)) return clearPost(storage);
  const chat = { ...post.chat };
  delete chat.employer;
  const stored: Stored = { ...post, chat, v: VERSION, savedAt: now };
  try {
    storage.setItem(POST_DRAFT_KEY, JSON.stringify(stored));
  } catch {
    // Full or blocked storage: the page works as before, without the safety net.
  }
}

/** The draft this account left in this tab within a day, or undefined; anything else found is cleared. */
export function loadPost(storage: DraftStorage, email: string, now = Date.now()): SavedPost | undefined {
  let stored: Partial<Stored> | null;
  try {
    stored = JSON.parse(storage.getItem(POST_DRAFT_KEY) ?? "null");
  } catch {
    stored = {};
  }
  if (!stored) return undefined;
  const fresh = typeof stored.savedAt === "number" && now - stored.savedAt <= MAX_AGE_MS && stored.savedAt <= now;
  const shaped =
    stored.v === VERSION &&
    typeof stored.text === "string" &&
    Array.isArray(stored.chat?.messages) &&
    typeof stored.form?.titleZh === "string" &&
    Array.isArray(stored.notes) &&
    (stored.mode === "chat" || stored.mode === "form") &&
    ["chat", "paste", "form", "preview"].includes(stored.step as string);
  if (!fresh || !shaped || stored.email !== email) {
    // Another account's draft is not shown here and not kept for it; an old or broken one is of no use.
    clearPost(storage);
    return undefined;
  }
  const post = stored as Stored;
  return {
    email: post.email,
    mode: post.mode,
    step: post.step,
    chat: post.chat,
    text: post.text,
    form: post.form,
    englishByHand: post.englishByHand === true,
    notes: post.notes,
  };
}

export function clearPost(storage: DraftStorage) {
  try {
    storage.removeItem(POST_DRAFT_KEY);
  } catch {
    // As in savePost.
  }
}
