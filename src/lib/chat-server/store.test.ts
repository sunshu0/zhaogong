import { describe, expect, it, vi } from "vitest";
import { EMPTY_CHAT } from "@/components/seeker/chat-store";

describe("chatServerStore", () => {
  it("is one store per server, even when the module is loaded twice (route handlers and Server Functions)", async () => {
    const first = await import("@/lib/chat-server/store");
    first.setChatServerStoreForTests();
    await first.chatServerStore().putChat("seeker:a@example.com", EMPTY_CHAT);

    vi.resetModules();
    const second = await import("@/lib/chat-server/store");
    expect(second).not.toBe(first);
    expect(second.chatServerStore()).toBe(first.chatServerStore());
    expect(await second.chatServerStore().getChat("seeker:a@example.com")).toEqual(EMPTY_CHAT);
  });
});
