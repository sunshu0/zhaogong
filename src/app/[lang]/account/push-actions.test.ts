import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PushOwner } from "@/db/push-subscriptions";
import { encode64 } from "@/lib/push/rules";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  moderator: vi.fn(),
  config: vi.fn(),
  claim: vi.fn(),
  keep: vi.fn(),
  owns: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("@/lib/auth/sessions", async (original) => ({
  ...(await original<typeof import("@/lib/auth/sessions")>()),
  currentPushSession: mocks.session,
}));
vi.mock("@/db/moderators", () => ({ isModerator: mocks.moderator }));
vi.mock("@/lib/push/web-push", () => ({ readyVapidConfig: mocks.config }));
vi.mock("@/db/push-subscriptions", () => ({
  claimPushAttempt: mocks.claim,
  keepPushSubscription: mocks.keep,
  ownsPushSubscription: mocks.owns,
  removePushSubscription: mocks.remove,
}));
vi.mock("@/i18n/server", () => ({ requestLang: async () => "en" }));
const { myPushSettings, enableMyPush, disableMyPush } = await import("./push-actions");
const owner: PushOwner = { id: "private-session", view: { email: "push@example.com", activeRole: "seeker" } };
const scope = JSON.stringify([owner.view.email, "seeker", null]);
async function subscription() {
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  return {
    endpoint: "https://fcm.googleapis.com/fcm/send/action-test",
    keys: {
      p256dh: encode64(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey))),
      auth: encode64(new Uint8Array(16)),
    },
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue(owner);
  mocks.moderator.mockResolvedValue(false);
  mocks.config.mockResolvedValue({ publicKey: "public-only" });
  mocks.claim.mockResolvedValue(true);
  mocks.keep.mockResolvedValue(true);
});
describe("browser push server actions", () => {
  it("returns only scope/public key/state, and honestly reports missing configuration", async () => {
    mocks.config.mockResolvedValue(undefined);
    expect(await myPushSettings()).toEqual({ scope, publicKey: null, enabled: false });
    expect(JSON.stringify(await myPushSettings())).not.toContain(owner.id);
    expect(await enableMyPush(await subscription(), scope)).toBe(false);
    expect(mocks.keep).not.toHaveBeenCalled();
  });
  it("requires the current session, role scope and a non-staff account", async () => {
    const value = await subscription();
    expect(await enableMyPush(value, "another-role")).toBe(false);
    mocks.moderator.mockResolvedValue(true);
    expect(await enableMyPush(value, scope)).toBe(false);
    expect(await myPushSettings()).toBeNull();
    mocks.session.mockResolvedValue(null);
    expect(await enableMyPush(value, scope)).toBe(false);
    expect(await disableMyPush(value.endpoint, scope)).toBe(false);
    expect(mocks.keep).not.toHaveBeenCalled();
  });
  it("validates a real P-256 point and applies cooldown before saving with server language", async () => {
    const value = await subscription();
    const fake = new Uint8Array(65);
    fake[0] = 4;
    expect(await enableMyPush({ ...value, keys: { ...value.keys, p256dh: encode64(fake) } }, scope)).toBe(false);
    expect(mocks.keep).not.toHaveBeenCalled();
    mocks.claim.mockResolvedValue(false);
    expect(await enableMyPush(value, scope)).toBe(false);
    mocks.claim.mockResolvedValue(true);
    expect(await enableMyPush(value, scope)).toBe(true);
    expect(mocks.keep).toHaveBeenCalledWith(owner, value, "en");
  });
  it("refuses arbitrary endpoints and stale-role cancellation; removal remains possible without config/cooldown", async () => {
    const value = await subscription();
    expect(await enableMyPush({ ...value, endpoint: "https://127.0.0.1/internal" }, scope)).toBe(false);
    expect(await disableMyPush(value.endpoint, "old-scope")).toBe(false);
    expect(mocks.remove).not.toHaveBeenCalled();
    mocks.config.mockResolvedValue(undefined);
    mocks.claim.mockResolvedValue(false);
    expect(await disableMyPush(value.endpoint, scope)).toBe(true);
    expect(mocks.remove).toHaveBeenCalledWith(owner, value.endpoint);
  });
});
