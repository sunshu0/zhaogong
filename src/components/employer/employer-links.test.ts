import { describe, expect, it } from "vitest";
import { parseLinks } from "@/components/employer/employer-links";

describe("parseLinks", () => {
  it("reads stored email → business links", () => {
    expect(parseLinks('{"a@b.nz":"e1","c@d.nz":"e4"}')).toEqual({ "a@b.nz": "e1", "c@d.nz": "e4" });
  });

  it("drops missing, broken or wrongly shaped values", () => {
    expect(parseLinks(null)).toEqual({});
    expect(parseLinks("{oops")).toEqual({});
    expect(parseLinks('["e1"]')).toEqual({});
    expect(parseLinks('{"a@b.nz":1,"c@d.nz":"e2"}')).toEqual({ "c@d.nz": "e2" });
  });
});
