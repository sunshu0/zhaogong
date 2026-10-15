import { describe, expect, it } from "vitest";
import {
  OUTBOX_KEY,
  addToOutbox,
  outboxFor,
  readOutbox,
  removeFromOutbox,
  type OutboxItem,
} from "@/components/seeker/chat-outbox";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

const item = (id: string, scope = "a"): OutboxItem => ({
  id,
  scope,
  change: { type: "send", conversationId: "north-tea", text: id },
});

describe("chat outbox", () => {
  it("keeps changes oldest first per identity until each is confirmed, then empties", () => {
    const storage = memoryStorage();
    addToOutbox(storage, item("1"));
    addToOutbox(storage, item("2", "b"));
    addToOutbox(storage, item("3"));
    expect(outboxFor(storage, "a").map((x) => x.id)).toEqual(["1", "3"]);
    expect(outboxFor(storage, "b").map((x) => x.id)).toEqual(["2"]);

    removeFromOutbox(storage, "1");
    expect(outboxFor(storage, "a").map((x) => x.id)).toEqual(["3"]);
    removeFromOutbox(storage, "2");
    removeFromOutbox(storage, "3");
    expect(storage.data.has(OUTBOX_KEY)).toBe(false);
  });

  it("adding the same id again does not send it twice", () => {
    const storage = memoryStorage();
    addToOutbox(storage, item("1"));
    addToOutbox(storage, item("1"));
    expect(readOutbox(storage)).toHaveLength(1);
  });

  it("keeps the newest 100 and drops what is not an outbox item", () => {
    const storage = memoryStorage();
    for (let i = 0; i < 105; i++) addToOutbox(storage, item(String(i)));
    expect(readOutbox(storage)).toHaveLength(100);
    expect(readOutbox(storage)[0].id).toBe("5");

    storage.setItem(OUTBOX_KEY, JSON.stringify([item("ok"), { id: 1 }, null, { id: "x", scope: "a" }, "text"]));
    expect(readOutbox(storage).map((x) => x.id)).toEqual(["ok"]);
    storage.setItem(OUTBOX_KEY, "not json");
    expect(readOutbox(storage)).toEqual([]);
  });
});
