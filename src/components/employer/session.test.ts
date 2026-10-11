import { describe, expect, it } from "vitest";
import { parseSession } from "@/components/employer/session";

describe("parseSession", () => {
  it("reads a stored session", () => {
    expect(parseSession('{"email":"a@b.nz","employerId":"e1"}')).toEqual({ email: "a@b.nz", employerId: "e1" });
  });

  it("ignores missing, broken or wrongly shaped values", () => {
    expect(parseSession(null)).toBeNull();
    expect(parseSession("{oops")).toBeNull();
    expect(parseSession('{"email":"a@b.nz"}')).toBeNull();
    expect(parseSession("null")).toBeNull();
  });
});
