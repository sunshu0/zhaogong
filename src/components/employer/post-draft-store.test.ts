import { describe, expect, it } from "vitest";
import { startChat } from "@/lib/ai-post";
import { emptyForm } from "@/components/employer/post-form";
import { clearPost, loadPost, POST_DRAFT_KEY, savePost, worthKeeping, type SavedPost } from "./post-draft-store";

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => void items.set(k, v),
    removeItem: (k: string) => void items.delete(k),
  };
}

const NOW = Date.UTC(2026, 9, 18, 0, 0, 0);

function post(overrides: Partial<SavedPost> = {}): SavedPost {
  return {
    email: "boss@example.com",
    mode: "form",
    step: "form",
    chat: startChat("NZ"),
    text: "Mt Eden 川菜馆招前厅服务员",
    form: { ...emptyForm(), titleZh: "前厅服务员" },
    englishByHand: false,
    notes: [],
    ...overrides,
  };
}

describe("the posting draft in this tab", () => {
  it("comes back for the same account", () => {
    const storage = memoryStorage();
    savePost(storage, post(), NOW);
    const back = loadPost(storage, "boss@example.com", NOW + 60_000);
    expect(back?.form.titleZh).toBe("前厅服务员");
    expect(back?.text).toBe("Mt Eden 川菜馆招前厅服务员");
    expect(back?.step).toBe("form");
  });

  it("does not keep who posts: the server says that each turn", () => {
    const storage = memoryStorage();
    const chat = { ...startChat("NZ"), employer: { verification: "business_verified" as const } };
    savePost(storage, post({ chat }), NOW);
    expect(storage.items.get(POST_DRAFT_KEY)).not.toContain("business_verified");
    expect(loadPost(storage, "boss@example.com", NOW)?.chat.employer).toBeUndefined();
  });

  it("is not shown to another account, and is cleared then", () => {
    const storage = memoryStorage();
    savePost(storage, post(), NOW);
    expect(loadPost(storage, "someone@example.com", NOW)).toBeUndefined();
    expect(storage.items.has(POST_DRAFT_KEY)).toBe(false);
  });

  it("lasts a day", () => {
    const storage = memoryStorage();
    savePost(storage, post(), NOW);
    expect(loadPost(storage, "boss@example.com", NOW + 24 * 3600_000)).toBeDefined();
    savePost(storage, post(), NOW);
    expect(loadPost(storage, "boss@example.com", NOW + 24 * 3600_000 + 1)).toBeUndefined();
    expect(storage.items.has(POST_DRAFT_KEY)).toBe(false);
  });

  it("ignores and clears what it cannot read: broken JSON, another version, a missing form", () => {
    for (const raw of [
      "{not json",
      JSON.stringify({ ...post(), v: 99, savedAt: NOW }),
      JSON.stringify({ v: 1, savedAt: NOW, email: "boss@example.com" }),
    ]) {
      const storage = memoryStorage();
      storage.setItem(POST_DRAFT_KEY, raw);
      expect(loadPost(storage, "boss@example.com", NOW)).toBeUndefined();
      expect(storage.items.has(POST_DRAFT_KEY)).toBe(false);
    }
  });

  it("is not kept while there is nothing in it, and goes when cleared", () => {
    const storage = memoryStorage();
    const empty = post({ text: " ", form: emptyForm() });
    expect(worthKeeping(empty)).toBe(false);
    savePost(storage, post(), NOW);
    savePost(storage, empty, NOW);
    expect(storage.items.has(POST_DRAFT_KEY)).toBe(false);
    savePost(storage, post(), NOW);
    clearPost(storage);
    expect(loadPost(storage, "boss@example.com", NOW)).toBeUndefined();
  });

  it("keeps the chat once it is past the greeting", () => {
    const chat = startChat("NZ");
    expect(worthKeeping(post({ text: "", form: emptyForm(), chat }))).toBe(false);
    const talked = { ...chat, messages: [...chat.messages, { id: "e1", from: "employer" as const, text: "招服务员" }] };
    expect(worthKeeping(post({ text: "", form: emptyForm(), chat: talked }))).toBe(true);
  });

  it("survives a storage that refuses to write", () => {
    const storage = {
      ...memoryStorage(),
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(() => savePost(storage, post(), NOW)).not.toThrow();
  });
});
