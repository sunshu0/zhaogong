import { describe, expect, it } from "vitest";
import { clearJobForm, jobDraftKey, loadJobForm, saveJobForm } from "@/components/employer/job-draft-store";
import { emptyForm } from "@/components/employer/post-form";

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

const ORIGINAL = { ...emptyForm(), titleZh: "前厅服务员" };
const CHANGED = { ...ORIGINAL, titleZh: "前厅领班" };
const T0 = Date.UTC(2026, 9, 18);

describe("job-draft-store (#193)", () => {
  it("keeps a changed form per page and job, for the same account within a day", () => {
    const storage = memoryStorage();
    saveJobForm(storage, "edit", "j9", { email: "boss@example.com", form: CHANGED, englishByHand: true }, ORIGINAL, T0);
    expect(storage.items.has(jobDraftKey("edit", "j9"))).toBe(true);
    expect(loadJobForm(storage, "edit", "j9", "boss@example.com", T0 + 1000)).toEqual({
      email: "boss@example.com",
      form: CHANGED,
      englishByHand: true,
    });
    expect(loadJobForm(storage, "copy", "j9", "boss@example.com", T0)).toBeUndefined();
    expect(loadJobForm(storage, "edit", "j8", "boss@example.com", T0)).toBeUndefined();
  });

  it("keeps nothing while the form is as the job was", () => {
    const storage = memoryStorage();
    saveJobForm(storage, "edit", "j9", { email: "boss@example.com", form: CHANGED, englishByHand: true }, ORIGINAL, T0);
    saveJobForm(
      storage,
      "edit",
      "j9",
      { email: "boss@example.com", form: { ...ORIGINAL }, englishByHand: true },
      ORIGINAL,
      T0,
    );
    expect(storage.items.size).toBe(0);
  });

  it("drops another account's form, an old one and a broken one", () => {
    const storage = memoryStorage();
    const keep = () =>
      saveJobForm(
        storage,
        "copy",
        "j9",
        { email: "boss@example.com", form: CHANGED, englishByHand: false },
        ORIGINAL,
        T0,
      );
    keep();
    expect(loadJobForm(storage, "copy", "j9", "staff@example.com", T0)).toBeUndefined();
    expect(storage.items.size).toBe(0);
    keep();
    expect(loadJobForm(storage, "copy", "j9", "boss@example.com", T0 + 25 * 3600_000)).toBeUndefined();
    storage.setItem(jobDraftKey("copy", "j9"), "{not json");
    expect(loadJobForm(storage, "copy", "j9", "boss@example.com", T0)).toBeUndefined();
    expect(storage.items.size).toBe(0);
  });

  it("works on without the safety net when storage refuses", () => {
    const refusing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(() =>
      saveJobForm(refusing, "edit", "j9", { email: "a@example.com", form: CHANGED, englishByHand: true }, ORIGINAL),
    ).not.toThrow();
    expect(() => clearJobForm(refusing, "edit", "j9")).not.toThrow();
  });
});
