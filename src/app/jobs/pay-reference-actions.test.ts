import { describe, expect, it } from "vitest";
import { payReferenceFor } from "@/app/jobs/pay-reference-actions";

describe("payReferenceFor (#85)", () => {
  it("works out the reference from the open jobs on the platform, with the time it was read", async () => {
    const answer = await payReferenceFor("hospitality", "akl-cbd");
    expect(answer?.reference).toMatchObject({ scope: expect.stringMatching(/^(region|area)$/) });
    expect(answer?.reference.count).toBeGreaterThanOrEqual(5);
    expect(Date.parse(answer!.at)).not.toBeNaN();
  });

  it("says when there are too few, and refuses an unknown industry", async () => {
    expect((await payReferenceFor("beauty", "akl-newmarket"))?.reference).toMatchObject({ scope: "none" });
    expect(await payReferenceFor("rocket-science", "akl-cbd")).toBeNull();
    expect(await payReferenceFor(5, "akl-cbd")).toBeNull();
  });
});
