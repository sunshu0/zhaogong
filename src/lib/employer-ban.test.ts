import { describe, expect, it } from "vitest";
import { currentBan, isBanned, isPermanentBan, isTempBanDays, tempBanEnd, tempBanUntil } from "@/lib/employer-ban";

const NOW = Date.parse("2026-10-27T01:00:00.000Z");
const HOUR = 3_600_000;

describe("employer bans (ADR 0044)", () => {
  it("a business never banned is not banned", () => {
    expect(isBanned({}, NOW)).toBe(false);
    expect(isBanned(undefined, NOW)).toBe(false);
    expect(isPermanentBan({})).toBe(false);
    expect(tempBanEnd({}, NOW)).toBeUndefined();
  });

  it("a permanent ban has no end", () => {
    const e = { bannedAt: "2026-10-01T00:00:00.000Z" };
    expect(isBanned(e, NOW)).toBe(true);
    expect(isBanned(e, NOW + 1000 * 24 * HOUR)).toBe(true);
    expect(isPermanentBan(e)).toBe(true);
    expect(tempBanEnd(e, NOW)).toBeUndefined();
  });

  it("a temporary ban holds until its end and is over from then on", () => {
    const until = new Date(NOW + HOUR).toISOString();
    const e = { bannedAt: "2026-10-26T00:00:00.000Z", bannedUntil: until };
    expect(isBanned(e, NOW)).toBe(true);
    expect(tempBanEnd(e, NOW)).toBe(until);
    expect(isBanned(e, NOW + HOUR - 1)).toBe(true);
    expect(isBanned(e, NOW + HOUR)).toBe(false);
    expect(tempBanEnd(e, NOW + HOUR)).toBeUndefined();
    expect(isPermanentBan(e)).toBe(false);
  });

  it("currentBan drops a temporary ban that is over and keeps the rest", () => {
    const over = {
      id: "e1",
      bannedAt: "2026-10-01T00:00:00.000Z",
      bannedUntil: "2026-10-04T00:00:00.000Z",
      banReason: "x",
    };
    expect(currentBan(over, NOW)).toEqual({ id: "e1" });
    const running = { ...over, bannedUntil: new Date(NOW + HOUR).toISOString() };
    expect(currentBan(running, NOW)).toBe(running);
    const permanent = { id: "e2", bannedAt: "2026-10-01T00:00:00.000Z" };
    expect(currentBan(permanent, NOW)).toBe(permanent);
    expect(currentBan(undefined, NOW)).toBeUndefined();
  });

  it("only 3, 7 and 30 days, counted from the moment of the ban", () => {
    expect(tempBanUntil(NOW, 3)).toBe("2026-10-30T01:00:00.000Z");
    expect(tempBanUntil(NOW, 30)).toBe("2026-11-26T01:00:00.000Z");
    expect([3, 7, 30].every(isTempBanDays)).toBe(true);
    expect([0, 1, 14, "7", undefined].some(isTempBanDays)).toBe(false);
  });
});
