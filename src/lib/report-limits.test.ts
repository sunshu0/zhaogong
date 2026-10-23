import { beforeEach, describe, expect, it } from "vitest";
import { databaseAuthStore } from "@/db/auth-store";
import { setAuthStoreForTests } from "@/lib/auth/store";
import { REPORT_LIMITS, reportCounts, reporterKey, takeReportCounts } from "@/lib/report-limits";

// Security review C (ADR 0034): the daily report counts, in the database's auth_limits as in production.
const day = new Date("2026-10-23T03:00:00.000Z");
const nextDay = new Date("2026-10-24T00:00:01.000Z");
const visitor = (n: number) => ({ visitor: String(n).padStart(22, "v") });

beforeEach(() => {
  setAuthStoreForTests(databaseAuthStore());
});

describe("who a report is from (reporterKey)", () => {
  it("is a keyed hash of the account or the visitor id, the same for the same person, none without either", () => {
    const account = reporterKey({ account: "Li@Example.com " });
    expect(account).toMatch(/^[0-9a-f]{64}$/);
    expect(reporterKey({ account: "li@example.com" })).toBe(account);
    expect(account).not.toContain("li@example.com");
    expect(reporterKey(visitor(1))).not.toBe(reporterKey(visitor(2)));
    expect(reporterKey(visitor(1))).not.toBe(account);
    expect(reporterKey(undefined)).toBeUndefined();
  });
});

describe("what one report counts (reportCounts)", () => {
  it("an account, and its screenshots; a visitor and the network; a browser with neither, the shared count", () => {
    expect(reportCounts({ account: "li@example.com" }, "203.0.113.5", 2)).toEqual([
      ["account", "li@example.com", 1],
      ["images", "li@example.com", 2],
    ]);
    expect(reportCounts(visitor(1), "203.0.113.5", 0)).toEqual([
      ["visitor", visitor(1).visitor, 1],
      ["ip", "203.0.113.5", 1],
    ]);
    expect(reportCounts(visitor(1), undefined, 0)).toEqual([["visitor", visitor(1).visitor, 1]]);
    expect(reportCounts(undefined, "203.0.113.5", 0)).toEqual([["ip", "203.0.113.5", 1]]);
    expect(reportCounts(undefined, undefined, 0)).toEqual([["unknown", "", 1]]);
  });
});

describe("the daily counts (takeReportCounts)", () => {
  it("let a visitor report 5 times a day and an account 10, then say which is full; a new day starts over", async () => {
    for (let i = 0; i < REPORT_LIMITS.visitor; i++)
      expect(await takeReportCounts(visitor(1), undefined, 0, day)).toBe(undefined);
    expect(await takeReportCounts(visitor(1), undefined, 0, day)).toBe("visitor");
    expect(await takeReportCounts(visitor(2), undefined, 0, day)).toBe(undefined); // another browser
    expect(await takeReportCounts(visitor(1), undefined, 0, nextDay)).toBe(undefined);

    const account = { account: "count@example.com" };
    for (let i = 0; i < REPORT_LIMITS.account; i++)
      expect(await takeReportCounts(account, undefined, 0, day)).toBe(undefined);
    expect(await takeReportCounts(account, undefined, 0, day)).toBe("account");
  });

  it("count screenshots per account: 20 a day", async () => {
    const account = { account: "images@example.com" };
    for (let i = 0; i < 6; i++) expect(await takeReportCounts(account, undefined, 3, day)).toBe(undefined); // 18
    expect(await takeReportCounts(account, undefined, 3, day)).toBe("images"); // 19, 20, then full
    expect(await takeReportCounts(account, undefined, 0, day)).toBe(undefined); // a report without any still goes
  });

  it("hold a network to 20 a day whatever the visitor id, and browsers with neither to 20 between them", async () => {
    for (let i = 0; i < REPORT_LIMITS.ip; i++)
      expect(await takeReportCounts(visitor(100 + i), "198.51.100.7", 0, day)).toBe(undefined);
    expect(await takeReportCounts(visitor(200), "198.51.100.7", 0, day)).toBe("ip");
    for (let i = 0; i < REPORT_LIMITS.unknown; i++)
      expect(await takeReportCounts(undefined, undefined, 0, day)).toBe(undefined);
    expect(await takeReportCounts(undefined, undefined, 0, day)).toBe("unknown");
  });

  it("let only the limit through when reports arrive at once (one statement each, ADR 0033)", async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, () => takeReportCounts(visitor(9), undefined, 0, day)),
    );
    expect(results.filter((r) => r === undefined)).toHaveLength(REPORT_LIMITS.visitor);
    expect(results.filter((r) => r === "visitor")).toHaveLength(12 - REPORT_LIMITS.visitor);
  });
});
