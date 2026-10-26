import { describe, expect, it } from "vitest";
import { showThenSend } from "@/components/ui/optimistic";

/** A value shown on screen, changed by show and undo, and what it was when the server was asked. */
function screen(start: string, next: string) {
  const s = { value: start, whenAsked: "" };
  return {
    s,
    show: () => (s.value = next),
    undo: () => (s.value = start),
  };
}

describe("showThenSend (#405)", () => {
  it("shows the change before the server answers and keeps it on a yes", async () => {
    const { s, show, undo } = screen("收藏", "已收藏");
    const sent = await showThenSend({
      show,
      undo,
      send: async () => {
        s.whenAsked = s.value;
        return ["j1"];
      },
    });
    expect(s.whenAsked).toBe("已收藏");
    expect(s.value).toBe("已收藏");
    expect(sent).toEqual({ ok: true, answer: ["j1"] });
  });

  it("takes the change back when the server gives no answer", async () => {
    const { s, show, undo } = screen("收藏", "已收藏");
    const sent = await showThenSend({ show, undo, send: () => Promise.reject(new Error("offline")) });
    expect(s.value).toBe("收藏");
    expect(sent).toEqual({ ok: false });
  });

  it("takes the change back when the server says no", async () => {
    const { s, show, undo } = screen("未标记", "合适");
    const sent = await showThenSend({ show, undo, send: async () => false });
    expect(s.value).toBe("未标记");
    expect(sent).toEqual({ ok: false });
  });

  it("asks the caller what counts as a no", async () => {
    const { s, show, undo } = screen("收藏", "已收藏");
    const sent = await showThenSend({ show, undo, send: async () => null, accepted: (answer) => answer !== null });
    expect(s.value).toBe("收藏");
    expect(sent).toEqual({ ok: false });
  });
});
