import { afterEach, describe, expect, it, vi } from "vitest";
import { counterpartActs, devRepliesEnabled } from "@/lib/chat-server/dev";
import { EMPTY_CHAT, addSentMessage, chatView } from "@/components/seeker/chat-store";
import { chatDemo } from "@/components/seeker/chat-demo";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the demo counterpart (development and browser tests only)", () => {
  it("is off in production", () => {
    expect(devRepliesEnabled()).toBe(true);
    vi.stubEnv("NODE_ENV", "production");
    expect(devRepliesEnabled()).toBe(false);
  });

  it("reads the user's messages, then replies; the reply is unread until the user reads the chat again", () => {
    const at = "2026-10-15T10:00:00.000Z";
    const later = "2026-10-15T10:05:00.000Z";
    const sent = addSentMessage(EMPTY_CHAT, "north-tea", "在吗", at);
    const next = counterpartActs(sent, "north-tea", { readMine: true, reply: " 在的 " }, later);
    expect(next.added["north-tea"]).toEqual([
      { from: "me", text: "在吗", time: "刚刚", sentAt: at, readAt: later },
      { from: "them", text: "在的", time: "刚刚", sentAt: later },
    ]);
    expect(chatView(next, chatDemo(false)).unread["north-tea"]).toBe(chatDemo(false).unread["north-tea"] + 1);
    expect(counterpartActs(sent, "north-tea", { reply: "  " }, later)).toEqual(sent);
  });
});
