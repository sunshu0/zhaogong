import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { memoryStore } from "@/db/evidence-store";
import {
  addPhoto,
  decidePhoto,
  findServablePhoto,
  forgetPhoto,
  getBenefits,
  listApprovedPhotoIds,
  listOwnPhotos,
  listPendingPhotos,
  listPhotosForExport,
  photoIdsOfBusiness,
  photoStillWanted,
  purgeExpiredPhotos,
  readOwnPhotos,
  removeOwnPhoto,
  resetPhotoCleanupForTests,
  saveBenefits,
} from "@/db/employer-photos";
import { getEmployerPage, saveEmployerPage } from "@/db/employer-profiles";
import { setPhotoStoreForTests } from "@/db/photo-store";
import { database } from "@/db/ready";
import * as t from "@/db/schema";
import { answerInvite, inviteToTeam } from "@/db/team";
import { banEmployer, createEmployer, ensureAccount, openEmployerIdentity } from "@/lib/data";
import { PHOTO_UPLOADS_PER_DAY, PHOTOS_MAX, REJECTED_KEEP_DAYS } from "@/lib/company-photos";

const T0 = new Date("2026-10-29T03:00:00.000Z");
const later = (hours: number) => new Date(T0.getTime() + hours * 3_600_000);
const MODERATOR = "photos.moderator@example.com";
let n = 0;
let store: ReturnType<typeof memoryStore>;

beforeEach(() => {
  store = memoryStore();
  setPhotoStoreForTests(store);
  resetPhotoCleanupForTests();
});
afterEach(() => {
  setPhotoStoreForTests(undefined);
  vi.restoreAllMocks();
});

/** A business opened by its admin, and a second account that joined it as a member. */
async function shop() {
  n += 1;
  const boss = `photos.boss${n}@example.com`;
  const staff = `photos.staff${n}@example.com`;
  await ensureAccount(boss);
  await ensureAccount(staff);
  const employer = await createEmployer({ name: `门店照片店${n}`, regionId: "akl-cbd" });
  await openEmployerIdentity(boss, employer.id);
  const invited = await inviteToTeam(employer.id, boss, staff, "member", T0);
  if (invited.status !== "invited") throw new Error(invited.status);
  await answerInvite(staff, invited.invite.id, { accept: true, name: "小李" }, T0);
  return { boss, staff, employer };
}

/** Uploads one photo as the action does: the row, then the file. */
async function upload(email: string, at = T0) {
  const id = randomUUID();
  const result = await addPhoto(email, { id, type: "image/webp", bytes: 1234 }, at);
  if (result === "added") await store.put(id, new Uint8Array([1, 2, 3]), "image/webp");
  return { id, result };
}

describe("addPhoto (ADR 0052)", () => {
  it("lets the business's admin add a photo, waiting for a moderator; refuses a member and an account without one", async () => {
    const { boss, staff, employer } = await shop();
    const { id, result } = await upload(` ${boss.toUpperCase()} `);
    expect(result).toBe("added");
    expect(await listOwnPhotos(employer.id, T0)).toEqual([
      { id, status: "pending", reason: null, uploadedAt: T0.toISOString(), reviewedAt: null },
    ]);
    const [row] = await (await database()).select().from(t.employerPhotos).where(eq(t.employerPhotos.id, id));
    expect(row).toMatchObject({
      employerId: employer.id,
      type: "image/webp",
      bytes: 1234,
      stored: 1,
      uploadedByEmail: boss,
    });
    expect((await upload(staff)).result).toBe("not_admin");
    await ensureAccount("photos.nobody@example.com");
    expect((await upload("photos.nobody@example.com")).result).toBe("no_business");
    expect(await listOwnPhotos(employer.id, T0)).toHaveLength(1);
  });

  it("refuses a seventh while six wait or are approved; one sent back frees its place", async () => {
    const { boss, employer } = await shop();
    const ids: string[] = [];
    for (let i = 0; i < PHOTOS_MAX; i++) ids.push((await upload(boss, later(i))).id);
    await decidePhoto(ids[0], MODERATOR, { approve: true }, later(6));
    expect((await upload(boss, later(7))).result).toBe("full");
    await decidePhoto(ids[1], MODERATOR, { approve: false, reason: "contact" }, later(7));
    expect((await upload(boss, later(8))).result).toBe("added");
    expect((await upload(boss, later(8))).result).toBe("full");
    expect(await listOwnPhotos(employer.id, later(8))).toHaveLength(PHOTOS_MAX + 1);
  });

  it("refuses the 21st upload in 24 hours, counting those sent back", async () => {
    const { boss, employer } = await shop();
    for (let i = 0; i < PHOTO_UPLOADS_PER_DAY; i++) {
      const { id, result } = await upload(boss, later(i / 2));
      expect(result).toBe("added");
      await decidePhoto(id, MODERATOR, { approve: false, reason: "unclear" }, later(i / 2));
    }
    expect((await upload(boss, later(12))).result).toBe("too_many");
    // A day after the first, its place in the count is free again.
    expect((await upload(boss, later(24.1))).result).toBe("added");
    expect((await listOwnPhotos(employer.id, later(24.1))).filter((p) => p.status === "pending")).toHaveLength(1);
  });

  it("refuses a banned business, a temporary ban while it runs (ADR 0044)", async () => {
    const { boss, employer } = await shop();
    await (
      await database()
    )
      .update(t.employers)
      .set({ bannedAt: T0.toISOString(), bannedUntil: later(72).toISOString() })
      .where(eq(t.employers.id, employer.id));
    expect((await upload(boss, later(1))).result).toBe("banned");
    expect((await upload(boss, later(73))).result).toBe("added");
    await banEmployer(employer.id);
    expect((await upload(boss, new Date())).result).toBe("banned");
    expect(await listOwnPhotos(employer.id, later(73))).toHaveLength(1);
  });

  it("forgetPhoto deletes the row of a photo whose file could not be stored", async () => {
    const { boss, employer } = await shop();
    const { id } = await upload(boss);
    await forgetPhoto(id);
    expect(await listOwnPhotos(employer.id, T0)).toEqual([]);
  });
});

describe("decidePhoto (ADR 0052)", () => {
  it("approves a waiting photo once; the public page and the moderators' queue follow", async () => {
    const { boss, employer } = await shop();
    const first = await upload(boss, T0);
    const second = await upload(boss, later(1));
    expect((await listPendingPhotos()).filter((p) => p.employerId === employer.id)).toEqual([
      { id: first.id, employerId: employer.id, employerName: employer.name, uploadedAt: T0.toISOString() },
      { id: second.id, employerId: employer.id, employerName: employer.name, uploadedAt: later(1).toISOString() },
    ]);
    expect(await decidePhoto(second.id, MODERATOR, { approve: true }, later(2))).toEqual({
      employerId: employer.id,
      employerName: employer.name,
    });
    await decidePhoto(first.id, MODERATOR, { approve: true }, later(2));
    expect(await listApprovedPhotoIds(employer.id)).toEqual([first.id, second.id]);
    expect(await decidePhoto(first.id, MODERATOR, { approve: false, reason: "faces" }, later(3))).toBeUndefined();
    expect(await listApprovedPhotoIds(employer.id)).toEqual([first.id, second.id]);
    expect((await listPendingPhotos()).filter((p) => p.employerId === employer.id)).toEqual([]);
  });

  it("sending back removes the file and keeps the reason; nothing more happens to a decided photo", async () => {
    const { boss, employer } = await shop();
    const { id } = await upload(boss);
    expect(await decidePhoto(id, MODERATOR, { approve: false, reason: "faces" }, later(1))).toBeDefined();
    expect(store.keys()).not.toContain(id);
    expect(await listOwnPhotos(employer.id, later(1))).toEqual([
      { id, status: "rejected", reason: "faces", uploadedAt: T0.toISOString(), reviewedAt: later(1).toISOString() },
    ]);
    expect(await photoIdsOfBusiness(employer.id)).toEqual([]);
    expect(await findServablePhoto(id, later(1))).toBeUndefined();
    expect(await decidePhoto(id, MODERATOR, { approve: true }, later(2))).toBeUndefined();
    expect(await listApprovedPhotoIds(employer.id)).toEqual([]);
  });

  it("keeps stored at 1 when the store does not remove the file, and listOwnPhotos tries again", async () => {
    const { boss, employer } = await shop();
    const { id } = await upload(boss);
    const remove = vi.spyOn(store, "remove").mockRejectedValueOnce(new Error("R2 is down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await decidePhoto(id, MODERATOR, { approve: false, reason: "unrelated" }, later(1));
    expect(store.keys()).toContain(id);
    expect(await photoIdsOfBusiness(employer.id)).toEqual([id]);
    // Not servable even so: it was sent back.
    expect(await findServablePhoto(id, later(1))).toBeUndefined();
    await listOwnPhotos(employer.id, later(2));
    expect(remove).toHaveBeenCalledTimes(2);
    expect(store.keys()).not.toContain(id);
    expect(await photoIdsOfBusiness(employer.id)).toEqual([]);
  });

  it("forgets photos sent back more than REJECTED_KEEP_DAYS ago", async () => {
    const { boss, employer } = await shop();
    const { id } = await upload(boss);
    const kept = await upload(boss, later(1));
    await decidePhoto(id, MODERATOR, { approve: false, reason: "inappropriate" }, later(1));
    const day = (d: number) => new Date(later(1).getTime() + d * 86_400_000);
    expect((await listOwnPhotos(employer.id, day(REJECTED_KEEP_DAYS - 1))).map((p) => p.id)).toEqual([id, kept.id]);
    expect((await listOwnPhotos(employer.id, day(REJECTED_KEEP_DAYS + 1))).map((p) => p.id)).toEqual([kept.id]);
    expect((await listPhotosForExport(employer.id, day(REJECTED_KEEP_DAYS + 1))).map((p) => p.id)).toEqual([kept.id]);
  });

  it("readOwnPhotos shows what listOwnPhotos would, writing nothing and retrying no file", async () => {
    const { boss, employer } = await shop();
    const { id } = await upload(boss);
    const old = await upload(boss, later(1));
    const remove = vi.spyOn(store, "remove").mockRejectedValueOnce(new Error("R2 is down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await decidePhoto(id, MODERATOR, { approve: false, reason: "unclear" }, later(1));
    await decidePhoto(old.id, MODERATOR, { approve: false, reason: "faces" }, later(1));
    const day = (d: number) => new Date(later(1).getTime() + d * 86_400_000);
    expect((await readOwnPhotos(employer.id, later(2))).map((p) => p.id)).toEqual([id, old.id]);
    expect(await readOwnPhotos(employer.id, day(REJECTED_KEEP_DAYS + 1))).toEqual([]);
    expect(remove).toHaveBeenCalledTimes(2);
    expect(await photoIdsOfBusiness(employer.id)).toEqual([id]);
    expect((await listPhotosForExport(employer.id, later(2))).map((p) => p.id)).toEqual([id, old.id]);
    // Sent back past keeping: not exported, even before anything deleted the rows (review F8 rework 1).
    expect(await listPhotosForExport(employer.id, day(REJECTED_KEEP_DAYS + 1))).toEqual([]);
  });
});

/** The photo's row as stored, or undefined once deleted. */
async function rowOf(id: string) {
  const [row] = await (await database()).select().from(t.employerPhotos).where(eq(t.employerPhotos.id, id));
  return row;
}

describe("purgeExpiredPhotos (review F8 rework 1)", () => {
  const day = (d: number) => new Date(later(1).getTime() + d * 86_400_000);

  it("removes files a store left behind and rows past keeping, for a business that never opens its photos", async () => {
    const { boss, employer } = await shop();
    const { id } = await upload(boss);
    const old = await upload(boss, later(1));
    vi.spyOn(store, "remove").mockRejectedValueOnce(new Error("R2 is down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await decidePhoto(id, MODERATOR, { approve: false, reason: "unclear" }, later(1));
    await decidePhoto(old.id, MODERATOR, { approve: false, reason: "faces" }, later(1));
    expect(store.keys()).toContain(id);
    await purgeExpiredPhotos(later(2));
    expect(store.keys()).not.toContain(id);
    expect(await rowOf(id)).toMatchObject({ status: "rejected", stored: 0 });
    // Kept REJECTED_KEEP_DAYS for their reason, then gone.
    await purgeExpiredPhotos(day(REJECTED_KEEP_DAYS - 1));
    expect(await rowOf(old.id)).toBeDefined();
    await purgeExpiredPhotos(day(REJECTED_KEEP_DAYS + 1));
    expect(await rowOf(id)).toBeUndefined();
    expect(await rowOf(old.id)).toBeUndefined();
    expect(await listPhotosForExport(employer.id, day(REJECTED_KEEP_DAYS + 1))).toEqual([]);
  });

  it("runs once a New Zealand day, and again the same day after a store did not answer", async () => {
    const { boss } = await shop();
    const { id } = await upload(boss);
    const remove = vi.spyOn(store, "remove").mockRejectedValueOnce(new Error("R2 is down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await decidePhoto(id, MODERATOR, { approve: false, reason: "unclear" }, later(1));
    // 03:00Z is 16:00 in Auckland: later(2) and later(3) are the same day there, later(10) the next.
    remove.mockRejectedValueOnce(new Error("R2 is still down"));
    await purgeExpiredPhotos(later(2));
    expect(store.keys()).toContain(id);
    await purgeExpiredPhotos(later(3));
    expect(store.keys()).not.toContain(id);
    expect(await rowOf(id)).toMatchObject({ stored: 0 });

    const next = await upload(boss, later(4));
    remove.mockRejectedValueOnce(new Error("R2 is down again"));
    await decidePhoto(next.id, MODERATOR, { approve: false, reason: "unclear" }, later(4));
    const calls = remove.mock.calls.length;
    await purgeExpiredPhotos(later(5));
    expect(remove.mock.calls.length).toBe(calls);
    expect(store.keys()).toContain(next.id);
    await purgeExpiredPhotos(later(10));
    expect(store.keys()).not.toContain(next.id);
  });
});

describe("findServablePhoto (ADR 0052)", () => {
  it("finds waiting and approved photos with their type, and says when the business is banned", async () => {
    const { boss, employer } = await shop();
    const { id } = await upload(boss);
    expect(await findServablePhoto(id, T0)).toEqual({
      employerId: employer.id,
      type: "image/webp",
      status: "pending",
      employerBanned: false,
    });
    await decidePhoto(id, MODERATOR, { approve: true }, later(1));
    expect(await findServablePhoto(id, later(1))).toMatchObject({ status: "approved", employerBanned: false });
    await banEmployer(employer.id);
    expect(await findServablePhoto(id, new Date())).toMatchObject({ status: "approved", employerBanned: true });
    expect(await findServablePhoto(randomUUID(), T0)).toBeUndefined();
  });

  it("counts a temporary ban while it runs, not after", async () => {
    const { boss, employer } = await shop();
    const { id } = await upload(boss);
    await (
      await database()
    )
      .update(t.employers)
      .set({ bannedAt: T0.toISOString(), bannedUntil: later(72).toISOString() })
      .where(eq(t.employers.id, employer.id));
    expect(await findServablePhoto(id, later(1))).toMatchObject({ employerBanned: true });
    expect(await findServablePhoto(id, later(73))).toMatchObject({ employerBanned: false });
  });
});

describe("removeOwnPhoto (ADR 0052)", () => {
  it("lets the admin delete a photo and its file, whatever its status; refuses a member and another business", async () => {
    const { boss, staff, employer } = await shop();
    const other = await shop();
    const { id } = await upload(boss);
    await decidePhoto(id, MODERATOR, { approve: true }, later(1));
    expect(await removeOwnPhoto(staff, id)).toBe("not_admin");
    expect(await removeOwnPhoto(other.boss, id)).toBe("not_found");
    expect(store.keys()).toContain(id);
    expect(await removeOwnPhoto(boss, id)).toBe("removed");
    expect(store.keys()).not.toContain(id);
    expect(await listOwnPhotos(employer.id, later(1))).toEqual([]);
    expect(await removeOwnPhoto(boss, id)).toBe("not_found");

    const sentBack = await upload(boss, later(2));
    await decidePhoto(sentBack.id, MODERATOR, { approve: false, reason: "unclear" }, later(3));
    expect(await removeOwnPhoto(boss, sentBack.id)).toBe("removed");
    expect(await listOwnPhotos(employer.id, later(3))).toEqual([]);
    expect(await removeOwnPhoto(boss, sentBack.id)).toBe("not_found");
    // The rows stay a day, out of sight, counting against the day's uploads (review F8 rework 1).
    expect(await rowOf(id)).toMatchObject({ status: "removed", stored: 0 });
    expect(await listPhotosForExport(employer.id, later(3))).toEqual([]);
    expect(await findServablePhoto(id, later(3))).toBeUndefined();
  });

  it("counts deleted photos against the day's uploads, so upload, delete, upload again stops at the limit", async () => {
    const { boss, employer } = await shop();
    for (let i = 0; i < PHOTO_UPLOADS_PER_DAY; i++) {
      const { id, result } = await upload(boss, later(i / 2));
      expect(result).toBe("added");
      expect(await removeOwnPhoto(boss, id)).toBe("removed");
      expect(store.keys()).not.toContain(id);
    }
    const refused = await upload(boss, later(12));
    expect(refused.result).toBe("too_many");
    expect(await listOwnPhotos(employer.id, later(12))).toEqual([]);
    expect(await listPhotosForExport(employer.id, later(12))).toEqual([]);
    // A day later the rows go, and the business may upload again.
    await purgeExpiredPhotos(later(34));
    expect(
      await (await database()).select().from(t.employerPhotos).where(eq(t.employerPhotos.employerId, employer.id)),
    ).toEqual([]);
    expect((await upload(boss, later(34))).result).toBe("added");
  });

  it("keeps a deleted photo's row marked stored when the store does not remove its file, and tries again", async () => {
    const { boss } = await shop();
    const { id } = await upload(boss);
    vi.spyOn(store, "remove").mockRejectedValueOnce(new Error("R2 is down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await removeOwnPhoto(boss, id)).toBe("removed");
    expect(await rowOf(id)).toMatchObject({ status: "removed", stored: 1 });
    expect(store.keys()).toContain(id);
    await purgeExpiredPhotos(later(1));
    expect(store.keys()).not.toContain(id);
    // Uploaded less than a day ago: the row stays to be counted.
    expect(await rowOf(id)).toMatchObject({ status: "removed", stored: 0 });
  });

  it("photoStillWanted is false once the row is deleted or gone", async () => {
    const { boss } = await shop();
    const { id } = await upload(boss);
    expect(await photoStillWanted(id)).toBe(true);
    await removeOwnPhoto(boss, id);
    expect(await photoStillWanted(id)).toBe(false);
    const forgotten = await upload(boss);
    await forgetPhoto(forgotten.id);
    expect(await photoStillWanted(forgotten.id)).toBe(false);
  });
});

describe("benefits (ADR 0052)", () => {
  it("keeps only known benefits in the list's order, for the admin; a member and no business are refused", async () => {
    const { boss, staff, employer } = await shop();
    expect(await getBenefits(employer.id)).toEqual([]);
    expect(await saveBenefits(boss, ["tips", "meals", "nonsense", "meals"] as never, T0)).toEqual(["meals", "tips"]);
    expect(await getBenefits(employer.id)).toEqual(["meals", "tips"]);
    // A business without a page gets an empty one.
    expect(await getEmployerPage(employer.id)).toMatchObject({ page: {}, updatedByEmail: boss });
    expect(await saveBenefits(staff, ["housing"], T0)).toBe("not_admin");
    await ensureAccount("photos.nobenefits@example.com");
    expect(await saveBenefits("photos.nobenefits@example.com", ["housing"], T0)).toBe("no_business");
    expect(await getBenefits(employer.id)).toEqual(["meals", "tips"]);
  });

  it("keeps the page when benefits are saved, and the benefits when the page is", async () => {
    const { boss, employer } = await shop();
    await saveEmployerPage(boss, { bio: "老店" }, T0);
    await saveBenefits(boss, ["housing"], later(1));
    expect(await getEmployerPage(employer.id)).toMatchObject({ page: { bio: "老店" }, benefits: ["housing"] });
    await saveEmployerPage(boss, { bio: "新店" }, later(2));
    expect(await getBenefits(employer.id)).toEqual(["housing"]);
  });
});
