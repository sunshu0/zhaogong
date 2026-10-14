import { describe, expect, it } from "vitest";
import { formatEmploymentTypes, normalizeEmploymentTypes } from "@/lib/employment-types";

describe("employment types", () => {
  it("turns a single stored type into a list", () => {
    expect(normalizeEmploymentTypes("part_time")).toEqual(["part_time"]);
  });

  it("keeps known types once, in the usual order", () => {
    expect(normalizeEmploymentTypes(["casual", "part_time", "casual", "full_time"])).toEqual([
      "full_time",
      "part_time",
      "casual",
    ]);
  });

  it("drops anything that is not a type", () => {
    expect(normalizeEmploymentTypes(["contract", 42, null, "casual"])).toEqual(["casual"]);
    expect(normalizeEmploymentTypes("contract")).toEqual([]);
    expect(normalizeEmploymentTypes(undefined)).toEqual([]);
    expect(normalizeEmploymentTypes({ type: "casual" })).toEqual([]);
  });

  it("formats a list in either language", () => {
    expect(formatEmploymentTypes(["full_time", "part_time"])).toBe("全职 / 兼职");
    expect(formatEmploymentTypes(["casual"], "en")).toBe("Casual");
    expect(formatEmploymentTypes(undefined)).toBe("");
  });
});
