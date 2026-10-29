import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createSession, type CookieJar } from "@/lib/auth";
import { setAuthStoreForTests } from "@/lib/auth/store";
import { createEmployer, ensureAccount, listModerationLog, openEmployerIdentity } from "@/lib/data";
import { memoryStore } from "@/db/evidence-store";
import { addPhoto, listApprovedPhotoIds, listOwnPhotos, removeOwnPhoto } from "@/db/employer-photos";
import { grantModerator } from "@/db/moderators";
import { setPhotoStoreForTests } from "@/db/photo-store";
import { myPhotoNotifications } from "@/app/[lang]/employer/photo-notifications";
import { notificationHref } from "@/components/seeker/hub-state";

// Server Functions read the request's cookies; here one jar stands in for one browser.
const cookies = new Map<string, string>();
const jar: CookieJar = {
  get: (name) => (cookies.has(name) ? { name, value: cookies.get(name)! } : undefined),
  set: (name, value) => void cookies.set(name, value),
  delete: (name) => void cookies.delete(name),
};
vi.mock("next/headers", () => ({ cookies: async () => jar }));

const { approvePhoto, getPhotoQueue, rejectPhoto } = await import("@/app/[lang]/admin/photo-actions");

const MODERATOR = "photo.queue.moderator@example.com";
const store = memoryStore();

async function signIn(email: string) {
  cookies.clear();
  await ensureAccount(email);
  await createSession(email, "seeker", jar);
}

let n = 0;
/** A new business whose admin has uploaded one photo, waiting for a moderator. */
async function uploaded() {
  n += 1;
  const email = `photo.queue.boss${n}@example.com`;
  await ensureAccount(email);
  const employer = await createEmployer({ name: `照片审核店${n}`, regionId: "akl-cbd" });
  await openEmployerIdentity(email, employer.id);
  const id = randomUUID();
  expect(await addPhoto(email, { id, type: "image/webp", bytes: 3 })).toBe("added");
  await store.put(id, new Uint8Array([1, 2, 3]), "image/webp");
  return { id, employer, email };
}

beforeAll(async () => {
  vi.stubEnv("ADMIN_ENABLED", "1");
  setAuthStoreForTests();
  setPhotoStoreForTests(store);
  await ensureAccount(MODERATOR);
  await grantModerator(MODERATOR, null);
});
afterAll(() => {
  setPhotoStoreForTests(undefined);
  vi.unstubAllEnvs();
});

describe("门店照片 in /admin (ADR 0052)", () => {
  it("is for moderators only", async () => {
    const { id, employer } = await uploaded();
    cookies.clear();
    expect(await getPhotoQueue()).toMatchObject({ refused: "signed_out" });
    await signIn("not.a.photo.moderator@example.com");
    expect(await getPhotoQueue()).toMatchObject({ refused: "not_moderator" });
    expect(await approvePhoto(id)).toMatchObject({ ok: false });
    expect(await rejectPhoto(id, "faces")).toMatchObject({ ok: false });
    expect((await listOwnPhotos(employer.id)).map((p) => p.status)).toEqual(["pending"]);
  });

  it("lists what waits, oldest first, with the business's name", async () => {
    const first = await uploaded();
    const second = await uploaded();
    await signIn(MODERATOR);
    const queue = await getPhotoQueue();
    if ("refused" in queue) throw new Error(queue.error_zh);
    const mine = queue.filter((p) => p.id === first.id || p.id === second.id);
    expect(mine).toEqual([
      {
        id: first.id,
        employerId: first.employer.id,
        employerName: first.employer.name,
        uploadedAt: expect.any(String),
      },
      {
        id: second.id,
        employerId: second.employer.id,
        employerName: second.employer.name,
        uploadedAt: expect.any(String),
      },
    ]);
  });

  it("approves a photo for the public page, and the log names who", async () => {
    const { id, employer } = await uploaded();
    await signIn(MODERATOR);
    expect(await approvePhoto(id)).toEqual({ ok: true, text: `通过「${employer.name}」的门店照片` });
    expect(await listApprovedPhotoIds(employer.id)).toEqual([id]);
    const [last] = await listModerationLog();
    expect(last).toMatchObject({ action: "photo_approve", employerId: employer.id, moderator: MODERATOR });
    const queue = await getPhotoQueue();
    if ("refused" in queue) throw new Error(queue.error_zh);
    expect(queue.map((p) => p.id)).not.toContain(id);
  });

  it("sends a photo back only with a known reason; the file goes, the business hears why", async () => {
    const { id, employer, email } = await uploaded();
    await signIn(MODERATOR);
    expect(await rejectPhoto(id, undefined)).toEqual({ ok: false, error_zh: "请选择退回理由。" });
    expect(await rejectPhoto(id, "ugly")).toEqual({ ok: false, error_zh: "请选择退回理由。" });
    expect(await rejectPhoto(id, "contact")).toEqual({
      ok: true,
      text: `退回「${employer.name}」的门店照片 · 照片里有电话、微信、二维码等联系方式`,
    });
    const [last] = await listModerationLog();
    expect(last).toMatchObject({ action: "photo_reject", note: "照片里有电话、微信、二维码等联系方式" });
    expect(await store.get(id)).toBeUndefined();
    expect(await listOwnPhotos(employer.id)).toMatchObject([{ id, status: "rejected", reason: "contact" }]);
    const notices = await myPhotoNotifications(email, Date.now());
    expect(notices).toEqual([
      {
        id: `photo:${id}:rejected`,
        type: "门店照片",
        title: "有一张门店照片被退回",
        detail: "照片里有电话、微信、二维码等联系方式。删掉它，换一张再传。",
        time: "今天",
        unread: true,
        target: { type: "photos" },
      },
    ]);
    expect(notificationHref(notices[0], { email, signedInAt: "", activeRole: "employer" })).toBe("/employer/photos");
  });

  it("answers a photo no longer waiting: decided by another, or deleted by its business", async () => {
    const decided = await uploaded();
    const deleted = await uploaded();
    await signIn(MODERATOR);
    expect(await approvePhoto(decided.id)).toMatchObject({ ok: true });
    const gone = { ok: false, error_zh: "这张照片已经处理过或被删除了。" };
    expect(await rejectPhoto(decided.id, "unclear")).toEqual(gone);
    expect(await removeOwnPhoto(deleted.email, deleted.id)).toBe("removed");
    expect(await approvePhoto(deleted.id)).toEqual(gone);
    expect(await approvePhoto("not-a-photo")).toEqual(gone);
  });
});
