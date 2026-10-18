import { describe, expect, it } from "vitest";
import { dateFormat, formatAmount, formatDate, formatMoney, formatNumber, formatTime } from "@/i18n/format";

// 2026-10-18 15:05 in Auckland (NZDT, UTC+13).
const when = new Date("2026-10-18T02:05:00Z");

describe("dates and times", () => {
  it("are New Zealand's, written the way each language writes them", () => {
    expect(formatDate(when, "zh")).toBe("2026年10月18日");
    expect(formatDate(when, "en")).toBe("18 Oct 2026");
    expect(formatDate(when, "en", { dateStyle: "long" })).toBe("18 October 2026");
    expect(formatDate(when, "zh", { month: "short", day: "numeric" })).toBe("10月18日");
    expect(formatDate(when, "en", { month: "short", day: "numeric" })).toBe("18 Oct");
    expect(formatTime(when, "zh")).toBe("15:05");
    expect(formatTime(when, "en")).toBe("3:05 pm");
  });

  it("take ISO strings and timestamps too, and the day is Auckland's even when UTC is still on the day before", () => {
    expect(formatDate("2026-10-17T12:30:00Z", "zh")).toBe("2026年10月18日");
    expect(formatDate(Date.parse("2026-10-17T12:30:00Z"), "en")).toBe("18 Oct 2026");
  });

  it("reuse one formatter per language and options", () => {
    expect(dateFormat("en", { weekday: "short" })).toBe(dateFormat("en", { weekday: "short" }));
    expect(dateFormat("en", { weekday: "short" })).not.toBe(dateFormat("zh", { weekday: "short" }));
    expect(dateFormat("zh", { weekday: "short" }).format(when)).toBe("周日");
  });
});

describe("numbers and money", () => {
  it("group thousands", () => {
    expect(formatNumber(12345.5, "zh")).toBe("12,345.5");
    expect(formatNumber(12345.5, "en")).toBe("12,345.5");
  });

  it("write whole amounts without cents and others with two digits", () => {
    expect([formatAmount(25, "zh"), formatAmount(24.5, "zh"), formatAmount(23.95, "en")]).toEqual([
      "25",
      "24.50",
      "23.95",
    ]);
    expect([formatMoney(25, "zh"), formatMoney(23.95, "en"), formatMoney(1234.5, "en")]).toEqual([
      "$25",
      "$23.95",
      "$1,234.50",
    ]);
  });
});
