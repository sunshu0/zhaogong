import { describe, expect, it } from "vitest";
import { NOTE_MAX, parseReport } from "@/components/seeker/report";

describe("parseReport", () => {
  it("accepts a known reason with an optional, trimmed note", () => {
    expect(parseReport({ reason: "charges_fee" })).toEqual({ ok: true, reason: "charges_fee" });
    expect(parseReport({ reason: "fake_job", note: "  电话打不通  " })).toEqual({
      ok: true,
      reason: "fake_job",
      note: "电话打不通",
    });
    expect(parseReport({ reason: "fake_job", note: "   " })).toEqual({ ok: true, reason: "fake_job" });
  });

  it("asks for a reason when none or an unknown one is given", () => {
    expect(parseReport({ reason: "" })).toEqual({ ok: false, error: "请选择举报原因" });
    expect(parseReport({ reason: "spam" })).toEqual({ ok: false, error: "请选择举报原因" });
    expect(parseReport({ reason: undefined })).toEqual({ ok: false, error: "请选择举报原因" });
  });

  it("asks for a note when the reason is 其他", () => {
    expect(parseReport({ reason: "other" })).toEqual({ ok: false, error: "选择“其他”时，请简单写一下原因" });
    expect(parseReport({ reason: "other", note: "雇主要求先交培训费" }).ok).toBe(true);
  });

  it("rejects a note that is too long", () => {
    expect(parseReport({ reason: "fake_job", note: "字".repeat(NOTE_MAX) }).ok).toBe(true);
    expect(parseReport({ reason: "fake_job", note: "字".repeat(NOTE_MAX + 1) })).toEqual({
      ok: false,
      error: `补充说明最多 ${NOTE_MAX} 字`,
    });
  });

  it("ignores values that are not strings", () => {
    expect(parseReport({ reason: 42 as unknown as string }).ok).toBe(false);
    expect(parseReport({ reason: "fake_job", note: {} as unknown as string })).toEqual({
      ok: true,
      reason: "fake_job",
    });
  });
});
