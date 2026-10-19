import { describe, expect, it } from "vitest";
import { shownLoad } from "@/components/ui/server-load";

describe("shownLoad (#246)", () => {
  it("shows nothing before the first answer, or with no key", () => {
    expect(shownLoad(undefined, "ann", 0)).toEqual({ value: undefined, failed: false });
    expect(shownLoad({ key: "ann", version: 0, value: 1 }, undefined, 0)).toEqual({ value: undefined, failed: false });
  });

  it("shows the answer, and keeps it while a reload is on its way", () => {
    const got = { key: "ann", version: 0, value: ["job"] };
    expect(shownLoad(got, "ann", 0)).toEqual({ value: ["job"], failed: false });
    expect(shownLoad(got, "ann", 1)).toEqual({ value: ["job"], failed: false });
  });

  it("keeps an answer that is null (a job that is not the account's)", () => {
    expect(shownLoad({ key: "ann job-1", version: 0, value: null }, "ann job-1", 0)).toEqual({
      value: null,
      failed: false,
    });
  });

  it("never shows another key's answer or failure", () => {
    expect(shownLoad({ key: "ann", version: 0, value: 1 }, "bob", 0)).toEqual({ value: undefined, failed: false });
    expect(shownLoad({ key: "ann", version: 0, failed: true }, "bob", 0)).toEqual({ value: undefined, failed: false });
  });

  it("says failed for the ask that failed, and goes back to waiting when it is asked again", () => {
    const got = { key: "ann", version: 2, failed: true as const };
    expect(shownLoad(got, "ann", 2)).toEqual({ value: undefined, failed: true });
    expect(shownLoad(got, "ann", 3)).toEqual({ value: undefined, failed: false });
  });
});
