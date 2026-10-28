import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { PUSH_WORKER } from "./service-worker";
function worker() {
  const handlers = new Map<string, (event: unknown) => void>();
  const showNotification = vi.fn().mockResolvedValue(undefined),
    openWindow = vi.fn().mockResolvedValue(undefined);
  const self = {
    location: { origin: "https://zhaogong.example" },
    addEventListener: (name: string, fn: (event: unknown) => void) => handlers.set(name, fn),
    registration: { showNotification },
    clients: { openWindow, claim: vi.fn() },
    skipWaiting: vi.fn(),
  };
  runInNewContext(PUSH_WORKER, { self, URL });
  async function event(name: string, value: object) {
    let pending: Promise<unknown> | undefined;
    handlers.get(name)!({
      ...value,
      waitUntil: (promise: Promise<unknown>) => {
        pending = promise;
      },
    });
    await pending;
  }
  return { handlers, showNotification, openWindow, event };
}
describe("push-only service worker", () => {
  it("shows only fixed generic text even when a payload includes private content", async () => {
    const w = worker();
    await w.event("push", {
      data: {
        json: () => ({
          version: 1,
          title: "Zhaogong",
          body: "private text",
          url: "/api/push/open?role=seeker&conversation=employer%3Ae1%3Aj1",
        }),
      },
    });
    expect(w.showNotification).toHaveBeenCalledWith(
      "Zhaogong",
      expect.objectContaining({ body: "You have a new message. Open Zhaogong to read it.", tag: "zhaogong-chat" }),
    );
    expect(JSON.stringify(w.showNotification.mock.calls)).not.toContain("private text");
    expect(w.handlers.has("fetch")).toBe(false);
  });
  it("ignores bad payloads and off-site/non-click-route targets", async () => {
    const w = worker();
    for (const url of ["https://evil.example/api/push/open", "/account", "//evil.example/api/push/open"]) {
      await w.event("push", { data: { json: () => ({ version: 1, url }) } });
      await w.event("notificationclick", { notification: { close() {}, data: { url } } });
    }
    await w.event("push", {
      data: {
        json() {
          throw new Error("not JSON");
        },
      },
    });
    expect(w.showNotification).not.toHaveBeenCalled();
    expect(w.openWindow).not.toHaveBeenCalled();
  });
  it("closes the notification then opens only the server-authorized click route", async () => {
    const w = worker(),
      close = vi.fn();
    const url = "https://zhaogong.example/api/push/open?role=employer&conversation=chat%3A12345678";
    await w.event("notificationclick", { notification: { close, data: { url } } });
    expect(close).toHaveBeenCalledOnce();
    expect(w.openWindow).toHaveBeenCalledWith(url);
  });
});
