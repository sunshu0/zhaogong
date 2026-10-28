import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createEmployer, ensureAccount, openEmployerIdentity } from "@/lib/data";
import { database } from "@/db/ready";
import { databaseAuthStore } from "@/db/auth-store";
import * as t from "@/db/schema";
import {
  claimPushAttempt,
  discardExpiredPush,
  keepPushSubscription,
  ownsPushSubscription,
  pushRecipients,
  removePushSubscription,
  removeSessionPushSubscriptions,
  type PushOwner,
} from "./push-subscriptions";
import { exportAccountData, deleteAccount } from "./account-data";

const now = new Date("2026-10-28T10:00:00Z");
async function owner(tag: string, email = `${tag}@example.com`): Promise<PushOwner> {
  await ensureAccount(email);
  await databaseAuthStore().insertSession({
    id: tag,
    email,
    activeRole: "seeker",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 3600_000).toISOString(),
  });
  return { id: tag, view: { email, activeRole: "seeker" } };
}
const subscription = (tag: string) => ({
  endpoint: `https://fcm.googleapis.com/fcm/send/${tag}`,
  keys: { p256dh: "key-for-database-test", auth: "auth-for-database-test" },
});
describe("push subscription ownership and lifecycle", () => {
  it("the coordination fallback removes only this exact login, including its paused role", async () => {
    const a = await owner("push.fallback.a");
    const b = await owner("push.fallback.b", a.view.email);
    const c = await owner("push.fallback.c");
    const paused: PushOwner = { ...a, view: { ...a.view, activeRole: "employer" } };
    await keepPushSubscription(a, subscription("fallback-a"), "zh", now);
    await keepPushSubscription(paused, subscription("fallback-paused"), "zh", now);
    await keepPushSubscription(b, subscription("fallback-b"), "zh", now);
    await keepPushSubscription(c, subscription("fallback-c"), "zh", now);
    await removeSessionPushSubscriptions(a);
    expect(await ownsPushSubscription(a, subscription("fallback-a").endpoint)).toBe(false);
    expect(await ownsPushSubscription(paused, subscription("fallback-paused").endpoint)).toBe(false);
    expect(await ownsPushSubscription(b, subscription("fallback-b").endpoint)).toBe(true);
    expect(await ownsPushSubscription(c, subscription("fallback-c").endpoint)).toBe(true);
  });
  it("cannot overwrite or delete another login/account's endpoint, and refreshes only its owner", async () => {
    const a = await owner("push.a"),
      b = await owner("push.b"),
      c = await owner("push.c", a.view.email);
    const value = subscription("ownership");
    expect(await keepPushSubscription(a, value, "zh", now)).toBe(true);
    expect(await keepPushSubscription(b, value, "en", now)).toBe(false);
    expect(await keepPushSubscription(c, value, "en", now)).toBe(false);
    await removePushSubscription(b, value.endpoint);
    expect(await ownsPushSubscription(a, value.endpoint)).toBe(true);
    expect(await ownsPushSubscription(c, value.endpoint)).toBe(false);
    expect(await keepPushSubscription(a, value, "en", now)).toBe(true);
  });
  it("stops a switched/expired/signed-out session and cascades subscription deletion on sign-out", async () => {
    const a = await owner("push.lifecycle");
    const value = subscription("lifecycle");
    await keepPushSubscription(a, value, "zh", now);
    await claimPushAttempt(a, now);
    const chat = { seekerEmail: a.view.email, employerId: "e1" };
    expect(await pushRecipients(chat, "seeker", now)).toHaveLength(1);
    await databaseAuthStore().setSessionRole(a.id, "employer");
    expect(await pushRecipients(chat, "seeker", now)).toHaveLength(0);
    await databaseAuthStore().setSessionRole(a.id, "seeker");
    expect(await pushRecipients(chat, "seeker", new Date(now.getTime() + 3600_001))).toHaveLength(0);
    await databaseAuthStore().deleteSession(a.id);
    expect(await ownsPushSubscription(a, value.endpoint)).toBe(false);
    expect(await (await database()).select().from(t.pushSetups).where(eq(t.pushSetups.sessionId, a.id))).toHaveLength(
      0,
    );
  });
  it("delivers to a current business team only, and stops after membership changes", async () => {
    const shop = await createEmployer({ name: "推送团队", regionId: "akl-cbd" });
    const a = await owner("push.team");
    await openEmployerIdentity(a.view.email, shop.id);
    await databaseAuthStore().setSessionRole(a.id, "employer");
    a.view.activeRole = "employer";
    await keepPushSubscription(a, subscription("team"), "zh", now);
    const chat = { seekerEmail: "someone@example.com", employerId: shop.id };
    expect(await pushRecipients(chat, "employer", now)).toHaveLength(1);
    await (await database()).update(t.accounts).set({ employerId: null }).where(eq(t.accounts.email, a.view.email));
    expect(await pushRecipients(chat, "employer", now)).toHaveLength(0);
  });
  it("caps concurrent setup storage and throttles repeated setup without throttling removal", async () => {
    const a = await owner("push.limit");
    const writes = await Promise.all(
      Array.from({ length: 15 }, (_, n) => keepPushSubscription(a, subscription(`limit${n}`), "zh", now)),
    );
    expect(writes.filter(Boolean)).toHaveLength(10);
    const attempts = await Promise.all(Array.from({ length: 4 }, () => claimPushAttempt(a, now)));
    expect(attempts.filter(Boolean)).toHaveLength(1);
    expect(await claimPushAttempt(a, new Date(now.getTime() + 10_001))).toBe(true);
    await removePushSubscription(a, subscription("limit0").endpoint);
    expect(await ownsPushSubscription(a, subscription("limit0").endpoint)).toBe(false);
  });
  it("exports only the account's subscriptions and deletes them with the account", async () => {
    const a = await owner("push.delete");
    await keepPushSubscription(a, subscription("delete"), "zh", now);
    await claimPushAttempt(a, now);
    expect((await exportAccountData(a.view.email))?.pushSubscriptions).toEqual([
      expect.objectContaining({ endpoint: subscription("delete").endpoint, role: "seeker" }),
    ]);
    expect(JSON.stringify((await exportAccountData(a.view.email))?.pushSubscriptions)).not.toContain("sessionId");
    expect((await exportAccountData(a.view.email))?.pushSetupAttempts).toEqual([{ attemptedAt: now.toISOString() }]);
    await deleteAccount(a.view.email);
    const db = await database();
    expect(await db.select().from(t.pushSubscriptions).where(eq(t.pushSubscriptions.email, a.view.email))).toHaveLength(
      0,
    );
    expect(await db.select().from(t.pushSetups).where(eq(t.pushSetups.sessionId, a.id))).toHaveLength(0);
  });
  it("does not let a stale 410 response delete a more recently refreshed subscription", async () => {
    const a = await owner("push.refresh");
    const value = subscription("refresh");
    await keepPushSubscription(a, value, "zh", now);
    await keepPushSubscription(a, value, "zh", new Date(now.getTime() + 1000));
    await discardExpiredPush(value.endpoint, a.id, now.toISOString());
    expect(await ownsPushSubscription(a, value.endpoint)).toBe(true);
  });
});
