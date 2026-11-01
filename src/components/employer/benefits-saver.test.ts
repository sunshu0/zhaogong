import { describe, expect, it } from "vitest";
import type { CompanyPhotosResult } from "@/app/[lang]/employer/photo-actions";
import type { Benefit } from "@/lib/company-photos";
import { createBenefitsSaver, type BenefitsNote } from "./benefits-saver";

const answer = (benefits: Benefit[], extra: Partial<CompanyPhotosResult> = {}): CompanyPhotosResult => ({
  snapshot: { scope: "s", employerId: "e1", photos: [], benefits, canEdit: true },
  said: "已自动保存",
  ...extra,
});

/** A saver whose saves wait until the test answers them, in any order. */
function setUp() {
  const pending: { list: Benefit[]; resolve: (r: CompanyPhotosResult | null) => void; reject: () => void }[] = [];
  const lists: Benefit[][] = [];
  const notes: (BenefitsNote | undefined)[] = [];
  const saver = createBenefitsSaver({
    save: (list) =>
      new Promise((resolve, reject) => pending.push({ list: [...list], resolve, reject: () => reject(new Error()) })),
    onList: (list) => lists.push([...list]),
    onNote: (note) => notes.push(note),
  });
  return { saver, pending, lists, notes };
}

describe("createBenefitsSaver", () => {
  it("saves each tick with the list so far, so two ticks in one frame both count (rework 1 #3)", async () => {
    const { saver, pending, lists } = setUp();
    saver.reset(["meals"], saver.stamp());
    saver.toggle("housing", true);
    saver.toggle("tips", true);
    expect(pending.map((p) => p.list)).toEqual([
      ["meals", "housing"],
      ["meals", "housing", "tips"],
    ]);
    expect(lists.at(-1)).toEqual(["meals", "housing", "tips"]);
  });

  it("drops an answer that comes back after a newer tick", async () => {
    const { saver, pending, lists, notes } = setUp();
    const first = saver.toggle("meals", true);
    const second = saver.toggle("housing", true);
    pending[1].resolve(answer(["meals", "housing"]));
    await second;
    pending[0].resolve(answer(["meals"]));
    await first;
    expect(lists.at(-1)).toEqual(["meals", "housing"]);
    expect(notes.at(-1)).toEqual({ kind: "said", ok: true, text: "已自动保存" });
  });

  it("does not stay on 正在保存… when the server finds no business, and reads the page again (rework 1 #1)", async () => {
    const { saver, pending, notes, lists } = setUp();
    const done = saver.toggle("meals", true);
    pending[0].resolve(null);
    expect(await done).toBe("gone");
    expect(notes).toEqual([{ kind: "saving" }, { kind: "failed" }]);
    // The page read again takes its snapshot's list: the save is no longer counted as on its way.
    saver.reset(["tips"], saver.stamp());
    expect(lists.at(-1)).toEqual(["tips"]);
  });

  it("says it failed when no answer comes", async () => {
    const { saver, pending, notes } = setUp();
    const done = saver.toggle("meals", true);
    pending[0].reject();
    await done;
    expect(notes.at(-1)).toEqual({ kind: "failed" });
  });

  it("keeps a newer tick over a snapshot read while its save is on its way", async () => {
    const { saver, pending, lists } = setUp();
    const done = saver.toggle("meals", true);
    saver.reset([], 0); // an upload's answer, asked for before the tick
    expect(lists.at(-1)).toEqual(["meals"]);
    pending[0].resolve(answer(["meals"]));
    await done;
    saver.reset(["meals", "bonus"], saver.stamp());
    expect(lists.at(-1)).toEqual(["meals", "bonus"]);
  });

  it("passes on a refusal (not an admin) as said", async () => {
    const { saver, pending, notes, lists } = setUp();
    saver.reset(["meals"], saver.stamp());
    const done = saver.toggle("housing", true);
    pending[0].resolve({ ...answer(["meals"]), said: "只有团队管理员能…", error: true });
    await done;
    expect(lists.at(-1)).toEqual(["meals"]);
    expect(notes.at(-1)).toEqual({ kind: "said", ok: false, text: "只有团队管理员能…" });
  });

  it("puts the boxes back to what the server has when a save fails or finds no business (rework 2 #8)", async () => {
    const { saver, pending, lists } = setUp();
    saver.reset(["meals"], saver.stamp());
    const lost = saver.toggle("housing", true);
    pending[0].reject();
    await lost;
    expect(lists.at(-1)).toEqual(["meals"]);
    const gone = saver.toggle("tips", true);
    pending[1].resolve(null);
    expect(await gone).toBe("gone");
    expect(lists.at(-1)).toEqual(["meals"]);
  });

  it("rolls back to the last list a save's answer confirmed, even one dropped for a newer tick", async () => {
    const { saver, pending, lists } = setUp();
    const first = saver.toggle("meals", true);
    const second = saver.toggle("housing", true);
    pending[0].resolve(answer(["meals"]));
    await first;
    expect(lists.at(-1)).toEqual(["meals", "housing"]); // dropped: the newer tick stays on screen
    pending[1].reject();
    await second;
    expect(lists.at(-1)).toEqual(["meals"]);
  });

  it("clears 没有保存成功 when a snapshot asked for after the failed save is taken (rework 3 #1)", async () => {
    const { saver, pending, notes } = setUp();
    const done = saver.toggle("meals", true);
    pending[0].reject();
    await done;
    expect(notes.at(-1)).toEqual({ kind: "failed" });
    saver.reset(["tips"], saver.stamp()); // a load or an upload sent now
    expect(notes.at(-1)).toBeUndefined();
  });

  it("keeps 没有保存成功 when the snapshot was asked for before the failed save (rework 4 #1)", async () => {
    const { saver, pending, notes, lists } = setUp();
    const uploadAskedAt = saver.stamp(); // an upload on its way
    const done = saver.toggle("meals", true);
    pending[0].reject();
    await done;
    saver.reset(["tips"], uploadAskedAt); // the upload's answer comes back after the failure
    expect(lists.at(-1)).toEqual(["tips"]);
    expect(notes.at(-1)).toEqual({ kind: "failed" });
  });

  it("does not ask the page to read itself after no answer; the next save's answer replaces the note (rework 3 #2)", async () => {
    const { saver, pending, notes } = setUp();
    const lost = saver.toggle("meals", true);
    pending[0].reject();
    expect(await lost).toBeUndefined();
    const next = saver.toggle("meals", true);
    pending[1].resolve(answer(["meals"]));
    await next;
    expect(notes.at(-1)).toEqual({ kind: "said", ok: true, text: "已自动保存" });
  });

  it("does not tick the boxes back for an upload's answer older than a save that went through (rework 5 #1)", async () => {
    const { saver, pending, notes, lists } = setUp();
    saver.reset([], saver.stamp());
    const uploadAskedAt = saver.stamp(); // an upload on its way
    const done = saver.toggle("meals", true);
    pending[0].resolve(answer(["meals"]));
    await done;
    saver.reset([], uploadAskedAt); // the upload's answer, from before the tick
    expect(lists.at(-1)).toEqual(["meals"]);
    expect(notes.at(-1)).toEqual({ kind: "said", ok: true, text: "已自动保存" });
    saver.reset(["meals", "tips"], saver.stamp()); // a read sent after the save is taken
    expect(lists.at(-1)).toEqual(["meals", "tips"]);
  });
});
