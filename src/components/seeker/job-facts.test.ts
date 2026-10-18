import { describe, expect, it } from "vitest";
import {
  contactKinds,
  expiry,
  expiryZh,
  formatDateZh,
  formatJobDate,
  isExpired,
  isPublic,
  minimumWageNote,
  shareDescription,
  shareTitle,
  verificationNote,
} from "@/components/seeker/job-facts";
import { MOCK_EMPLOYERS, MOCK_JOBS } from "@/mock/data";
import type { Job } from "@/lib/types";

const job = (id: string): Job => MOCK_JOBS.find((j) => j.id === id)!;
const employer = (id: string) => MOCK_EMPLOYERS.find((e) => e.id === id)!;

describe("minimumWageNote", () => {
  // NZ adult minimum wage in the config: 23.95 from 2026-04-01.
  it("says nothing when pay is more than a dollar above the minimum wage", () => {
    expect(minimumWageNote({ min: 25 }, "NZ")).toBeUndefined();
    expect(minimumWageNote({ min: 30, max: 35 }, "NZ")).toBeUndefined();
  });

  it("notes pay within a dollar of the minimum wage, naming the rate and the date", () => {
    expect(minimumWageNote({ min: 24.95 }, "NZ")).toEqual({
      level: "near",
      text: "接近新西兰成人最低时薪 $23.95（2026-04-01 起）。",
    });
    expect(minimumWageNote({ min: 24, max: 26 }, "NZ")?.level).toBe("near");
  });

  it("notes pay at the minimum wage", () => {
    expect(minimumWageNote({ min: 23.95 }, "NZ")).toEqual({
      level: "at",
      text: "等于新西兰成人最低时薪 $23.95（2026-04-01 起）。",
    });
  });

  it("warns when pay is below the minimum wage and points to reporting", () => {
    const note = minimumWageNote({ min: 22 }, "NZ");
    expect(note?.level).toBe("below");
    expect(note?.text).toContain("低于新西兰成人最低时薪 $23.95");
    expect(note?.text).toContain("举报");
  });

  it("says nothing for a market without a minimum wage configured", () => {
    expect(minimumWageNote({ min: 10 }, "AU")).toBeUndefined();
  });
});

describe("verificationNote", () => {
  it("explains each badge in one line and names the business number", () => {
    expect(verificationNote("business_verified", "NZ")).toContain("NZBN");
    expect(verificationNote("accredited_employer", "NZ")).toContain("认证雇主");
    expect(verificationNote("unverified", "NZ")).toContain("不要");
  });
});

describe("share text", () => {
  it("puts title, pay and region in the title", () => {
    expect(shareTitle(job("j1"))).toBe("前厅服务员 · $25–27/小时 · Mt Eden / Dominion Rd");
  });

  it("describes the job with employer, type and the start of the description", () => {
    const text = shareDescription(job("j1"), employer("e1"));
    expect(text.startsWith("川味小馆 · 兼职 · 负责点餐")).toBe(true);
    expect(text.length).toBeLessThanOrEqual(100);
  });
});

describe("dates", () => {
  it("shows dates in New Zealand time", () => {
    // 11:30 UTC on 10 Oct is already 11 Oct in Auckland (NZDT, UTC+13).
    expect(formatDateZh("2026-10-10T11:30:00Z", "NZ")).toBe("10月11日");
    expect(formatDateZh("2026-10-10T10:30:00Z", "NZ")).toBe("10月10日");
  });

  it("counts the days left before a job expires", () => {
    const now = Date.parse("2026-10-11T00:00:00Z");
    expect(expiryZh("2026-11-09T00:00:00Z", now, "NZ")).toBe("11月9日截止（还有 29 天）");
    expect(expiryZh("2026-10-11T12:00:00Z", now, "NZ")).toBe("10月12日截止（还有 1 天）");
    expect(expiryZh("2026-10-10T00:00:00Z", now, "NZ")).toBe("10月10日已截止");
  });
});

describe("visibility", () => {
  const now = Date.parse("2026-10-11T00:00:00Z");

  it("shows active and expired jobs, hides removed and unreviewed ones", () => {
    expect(isPublic(job("j1"))).toBe(true);
    expect(isPublic({ ...job("j1"), status: "expired" })).toBe(true);
    expect(isPublic({ ...job("j1"), status: "removed" })).toBe(false);
    expect(isPublic({ ...job("j1"), status: "pending_review" })).toBe(false);
  });

  it("treats a job past its expiry date as expired even if still marked active", () => {
    expect(isExpired(job("j1"), now)).toBe(false);
    expect(isExpired({ ...job("j1"), expiresAt: "2026-10-10T00:00:00Z" }, now)).toBe(true);
    expect(isExpired({ ...job("j1"), status: "expired" }, now)).toBe(true);
  });
});

describe("contactKinds", () => {
  it("names the kinds of contact without their values", () => {
    expect(contactKinds(job("j1"))).toEqual(["电话", "微信"]);
    expect(contactKinds(job("j3"))).toEqual(["电话", "邮箱"]);
    expect(contactKinds({ ...job("j1"), contact: {} })).toEqual([]);
  });
});

describe("in English (Round 20)", () => {
  it("names the adult minimum wage, the badge's meaning, the dates and the contact kinds", () => {
    expect(minimumWageNote({ min: 23.95 }, "NZ", "en")?.text).toBe(
      "The same as the adult minimum wage in New Zealand, $23.95 an hour (from 1 Apr 2026).",
    );
    expect(verificationNote("business_verified", "NZ", "en")).toContain("NZBN");
    expect(formatJobDate("2026-10-10T11:30:00Z", "NZ", "en")).toBe("11 October");
    expect(expiry("2026-10-11T12:00:00Z", Date.parse("2026-10-10T12:00:00Z"), "NZ", "en")).toBe(
      "Closes 12 October (in 1 day)",
    );
  });
});
