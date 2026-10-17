import { describe, expect, it } from "vitest";
import type { Finding } from "@/lib/compliance";
import { fieldTone, selectTone } from "./field-tone";

const finding = (level: Finding["level"]): Finding => ({ level, field: "pay", message_zh: "…", rule: "min_wage" });

describe("selectTone and fieldTone", () => {
  it("are plain when the field is filled and nothing is wrong", () => {
    expect(selectTone({ missing: false, findings: [] })).toBeUndefined();
    expect(fieldTone({ missing: false, findings: [] })).toBe("border-border");
  });

  it("are amber when the parser could not fill the field", () => {
    expect(selectTone({ missing: true, findings: [] })).toBe("warn");
    expect(fieldTone({ missing: true, findings: [] })).toBe("border-warn bg-warn-soft/40");
  });

  it("are red for a finding that holds publishing, even when the field is also missing", () => {
    for (const level of ["block", "rewrite"] as const) {
      expect(selectTone({ missing: true, findings: [finding(level)] })).toBe("danger");
      expect(fieldTone({ missing: false, findings: [finding(level)] })).toBe("border-danger");
    }
  });

  it("leave a finding for review alone: it goes to the moderators and does not colour the field", () => {
    expect(selectTone({ missing: false, findings: [finding("review")] })).toBeUndefined();
    expect(selectTone({ missing: true, findings: [finding("review")] })).toBe("warn");
    expect(fieldTone({ missing: false, findings: [finding("review")] })).toBe("border-border");
  });
});
