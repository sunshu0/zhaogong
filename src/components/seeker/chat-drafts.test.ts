import { describe, expect, it } from "vitest";
import { DRAFTS_KEY, readDraft, writeDraft } from "@/components/seeker/chat-drafts";
import { MESSAGE_MAX } from "@/components/seeker/chat-store";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe("chat drafts (#281)", () => {
  it("keep one draft per identity and conversation", () => {
    const storage = memoryStorage();
    writeDraft(storage, "seeker:a@example.com", "north-tea", "你好，");
    writeDraft(storage, "seeker:a@example.com", "harbour", "请问");
    writeDraft(storage, "employer:a@example.com", "north-tea", "您好");
    expect(readDraft(storage, "seeker:a@example.com", "north-tea")).toBe("你好，");
    expect(readDraft(storage, "seeker:a@example.com", "harbour")).toBe("请问");
    expect(readDraft(storage, "employer:a@example.com", "north-tea")).toBe("您好");
    expect(readDraft(storage, "seeker:b@example.com", "north-tea")).toBe("");
  });

  it("go once emptied, as when the message is sent, and the key goes with the last one", () => {
    const storage = memoryStorage();
    writeDraft(storage, "s", "north-tea", "你好");
    writeDraft(storage, "s", "north-tea", "");
    expect(readDraft(storage, "s", "north-tea")).toBe("");
    expect(storage.data.has(DRAFTS_KEY)).toBe(false);
  });

  it("stop at the message limit, keep the newest 50, and survive a broken entry", () => {
    const storage = memoryStorage();
    writeDraft(storage, "s", "long", "长".repeat(MESSAGE_MAX + 10));
    expect(readDraft(storage, "s", "long")).toHaveLength(MESSAGE_MAX);
    for (let i = 0; i < 55; i++) writeDraft(storage, "s", `c${i}`, `草稿 ${i}`);
    expect(readDraft(storage, "s", "long")).toBe("");
    expect(readDraft(storage, "s", "c4")).toBe("");
    expect(readDraft(storage, "s", "c5")).toBe("草稿 5");
    expect(readDraft(storage, "s", "c54")).toBe("草稿 54");
    storage.setItem(DRAFTS_KEY, "{not json");
    expect(readDraft(storage, "s", "c54")).toBe("");
    writeDraft(storage, "s", "north-tea", "重新写");
    expect(readDraft(storage, "s", "north-tea")).toBe("重新写");
  });
});
