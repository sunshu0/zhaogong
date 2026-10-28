import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  recipients: vi.fn(),
  discard: vi.fn(),
  send: vi.fn(),
  config: vi.fn(),
  authorizer: vi.fn(),
}));
vi.mock("@/db/push-subscriptions", () => ({ pushRecipients: mocks.recipients, discardExpiredPush: mocks.discard }));
vi.mock("./web-push", () => ({ sendPush: mocks.send, vapidConfig: mocks.config, vapidAuthorizer: mocks.authorizer }));
const { deliverChatPush } = await import("./delivery");
const row = { id: "chat-private-id", seekerEmail: "private@example.com", employerId: "e1", jobId: "j1" };
const recipient = (n: number) => ({
  subscription: {
    endpoint: `https://fcm.googleapis.com/fcm/send/${n}`,
    p256dh: "key",
    auth: "secret",
    sessionId: `session${n}`,
    updatedAt: "timestamp",
    lang: n % 2 ? "zh" : "en",
  },
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.config.mockReturnValue({});
  mocks.recipients.mockResolvedValue([recipient(0)]);
  mocks.send.mockResolvedValue("sent");
  mocks.authorizer.mockImplementation(() => async () => "vapid t=token, k=key");
  vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});
describe("best effort chat push delivery", () => {
  it("sends only generic text to the opposite identity and logs only aggregate outcomes", async () => {
    await deliverChatPush(row, "employer");
    expect(mocks.recipients).toHaveBeenCalledWith(row, "seeker");
    const payload = JSON.parse(mocks.send.mock.calls[0][1]);
    expect(payload).toEqual({
      version: 1,
      title: "Zhaogong",
      body: "You have a new message. Open Zhaogong to read it.",
      url: "/api/push/open?role=seeker&conversation=employer%3Ae1%3Aj1",
      tag: "zhaogong-chat",
    });
    expect(console.info).toHaveBeenCalledWith(
      JSON.stringify({ event: "chat_push", sent: 1, expired: 0, failed: 0, skipped: 0 }),
    );
  });
  it("cleans only an expired version; failed sends do not reject the saved message operation", async () => {
    mocks.recipients.mockResolvedValue([recipient(0), recipient(1), recipient(2)]);
    mocks.send
      .mockResolvedValueOnce("expired")
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce("failed");
    await expect(deliverChatPush(row, "seeker")).resolves.toBeUndefined();
    expect(mocks.discard).toHaveBeenCalledExactlyOnceWith(recipient(0).subscription.endpoint, "session0", "timestamp");
    expect(console.info).toHaveBeenCalledWith(
      JSON.stringify({ event: "chat_push", sent: 0, expired: 1, failed: 2, skipped: 0 }),
    );
  });
  it("shares one per-origin VAPID authorizer across every recipient of a delivery", async () => {
    mocks.recipients.mockResolvedValue([recipient(0), recipient(1), recipient(2)]);
    await deliverChatPush(row, "seeker");
    expect(mocks.authorizer).toHaveBeenCalledExactlyOnceWith({});
    const authorize = mocks.authorizer.mock.results[0].value;
    expect(mocks.send.mock.calls.map((call) => call[4])).toEqual([authorize, authorize, authorize]);
  });
  it("skips without deployment config, a live recipient, or a retained job", async () => {
    mocks.config.mockReturnValue(undefined);
    await deliverChatPush(row, "seeker");
    expect(mocks.recipients).not.toHaveBeenCalled();
    mocks.config.mockReturnValue({});
    await deliverChatPush({ ...row, jobId: null }, "seeker");
    mocks.recipients.mockResolvedValue([]);
    await deliverChatPush(row, "seeker");
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("bounds active sends to ten and stops starting batches after twenty seconds", async () => {
    mocks.recipients.mockResolvedValue(Array.from({ length: 50 }, (_, n) => recipient(n)));
    let time = 0,
      active = 0,
      peak = 0;
    vi.spyOn(Date, "now").mockImplementation(() => time);
    mocks.send.mockImplementation(async () => {
      active++;
      peak = Math.max(peak, active);
      await Promise.resolve();
      active--;
      time = 20_001;
      return "sent";
    });
    await deliverChatPush(row, "seeker");
    expect(peak).toBe(10);
    expect(mocks.send).toHaveBeenCalledTimes(10);
    expect(console.info).toHaveBeenCalledWith(
      JSON.stringify({ event: "chat_push", sent: 10, expired: 0, failed: 0, skipped: 40 }),
    );
  });
});
