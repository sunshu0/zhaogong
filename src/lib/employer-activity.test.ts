import { describe, expect, it } from "vitest";
import { activeToday, employerActivity, replySpeed, type FirstReply } from "@/lib/employer-activity";

// 2026-10-24 18:00 in Auckland (NZDT, UTC+13).
const now = Date.parse("2026-10-24T05:00:00.000Z");
const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();
/** A conversation asked `askedMinutesAgo` and answered `waitMinutes` later (null: not answered). */
const asked = (askedMinutesAgo: number, waitMinutes: number | null): FirstReply => ({
  askedAt: ago(askedMinutesAgo),
  repliedAt: waitMinutes == null ? null : ago(askedMinutesAgo - waitMinutes),
});

describe("activeToday (Auckland's day)", () => {
  it("is today from Auckland's midnight, not the server's", () => {
    expect(activeToday(ago(17 * 60), now)).toBe(true); // 01:00 today in Auckland, still yesterday in UTC
    expect(activeToday("2026-10-23T10:59:00.000Z", now)).toBe(false); // 23:59 yesterday in Auckland
    expect(activeToday("2026-10-23T11:00:00.000Z", now)).toBe(true); // 00:00 today in Auckland
  });

  it("is nothing without a time, with a bad one, or with one after now", () => {
    expect(activeToday(undefined, now)).toBe(false);
    expect(activeToday(null, now)).toBe(false);
    expect(activeToday("soon", now)).toBe(false);
    expect(activeToday(new Date(now + 60_000).toISOString(), now)).toBe(false);
  });
});

describe("replySpeed", () => {
  it("says nothing with no conversations or fewer than five", () => {
    expect(replySpeed([], now)).toBeUndefined();
    expect(
      replySpeed(
        [1, 2, 3, 4].map((i) => asked(i * 100, 5)),
        now,
      ),
    ).toBeUndefined();
  });

  it("is within an hour, or within a day, by the median of five or more", () => {
    expect(
      replySpeed(
        [1, 2, 3, 4, 5].map((i) => asked(i * 100, 10)),
        now,
      ),
    ).toBe("hour");
    expect(
      replySpeed(
        [10, 20, 30, 50, 600].map((wait, i) => asked(2000 + i, wait)),
        now,
      ),
    ).toBe("hour");
    expect(
      replySpeed(
        [10, 20, 120, 300, 600].map((wait, i) => asked(2000 + i, wait)),
        now,
      ),
    ).toBe("day");
    expect(
      replySpeed(
        [60, 60, 60, 60, 60].map((wait, i) => asked(2000 + i, wait)),
        now,
      ),
    ).toBe("hour");
  });

  it("says nothing when it is slow: over a day, or most never answered", () => {
    expect(
      replySpeed(
        [1, 2, 3, 4, 5].map((i) => asked(10_000 + i, 25 * 60)),
        now,
      ),
    ).toBeUndefined();
    const unanswered = [asked(3000, 5), asked(3001, 5), asked(3002, null), asked(3003, null), asked(3004, null)];
    expect(replySpeed(unanswered, now)).toBeUndefined();
  });

  it("takes the later middle one for an even count", () => {
    const six = [5, 10, 20, 90, 120, 180].map((wait, i) => asked(3000 + i, wait));
    expect(replySpeed(six, now)).toBe("day");
  });

  it("leaves out a question under a day old with no answer yet, and anything outside the 30 days", () => {
    const fast = [1, 2, 3, 4].map((i) => asked(2000 + i, 5));
    expect(replySpeed([...fast, asked(60, null)], now)).toBeUndefined(); // only four count
    expect(replySpeed([...fast, asked(24 * 60, null), asked(25 * 60, 1)], now)).toBe("hour");
    expect(replySpeed([...fast, asked(31 * 24 * 60, 5)], now)).toBeUndefined();
    expect(
      replySpeed([...fast, { askedAt: new Date(now + 60_000).toISOString(), repliedAt: null }], now),
    ).toBeUndefined();
  });
});

describe("employerActivity", () => {
  it("has only what is good to say", () => {
    const fast = [1, 2, 3, 4, 5].map((i) => asked(i * 100, 10));
    expect(employerActivity({ lastActiveAt: ago(30), conversations: fast }, now)).toEqual({
      onlineToday: true,
      replies: "hour",
    });
    expect(employerActivity({ lastActiveAt: ago(24 * 60), conversations: [] }, now)).toEqual({});
    expect(employerActivity({ conversations: fast }, now)).toEqual({ replies: "hour" });
  });
});
