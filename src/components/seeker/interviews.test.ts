import { describe, expect, it } from "vitest";
import {
  aucklandToInstant,
  employerInterviewStatus,
  formatSlot,
  instantToAuckland,
  interviewIcs,
  interviewModeName,
  interviewTodo,
  parseInvite,
  parseResponse,
  seekerInterviewStatus,
  soonDay,
  whenText,
  type InterviewView,
} from "@/components/seeker/interviews";

const now = Date.parse("2026-10-17T01:00:00.000Z"); // 2026-10-17 14:00 in Auckland (NZDT, +13)

const view = (patch: Partial<InterviewView> = {}): InterviewView => ({
  slots: ["2026-10-20T01:30:00.000Z"],
  callFirst: false,
  mode: "in_person",
  place: "Queen St 店里",
  note: "",
  status: "proposed",
  chosenSlot: null,
  reply: "",
  invitedAt: "2026-10-17T00:00:00.000Z",
  respondedAt: null,
  ...patch,
});

describe("Auckland time (#103)", () => {
  it("turns a wall-clock time into an instant and back, across daylight saving", () => {
    expect(aucklandToInstant("2026-10-20T14:30")).toBe("2026-10-20T01:30:00.000Z"); // NZDT +13
    expect(aucklandToInstant("2026-07-01T09:00")).toBe("2026-06-30T21:00:00.000Z"); // NZST +12
    expect(instantToAuckland("2026-10-20T01:30:00.000Z")).toBe("2026-10-20T14:30");
    expect(instantToAuckland("2026-06-30T21:00:00.000Z")).toBe("2026-07-01T09:00");
  });

  it("refuses what is not a time, and the hour skipped when clocks go forward", () => {
    expect(aucklandToInstant("")).toBeNull();
    expect(aucklandToInstant("2026-02-30T10:00")).toBeNull();
    expect(aucklandToInstant("2026-09-27T02:30")).toBeNull(); // 02:00 → 03:00 on 27 Sep 2026
  });

  it("shows times in Auckland, and says 今天 / 明天 by Auckland's calendar", () => {
    expect(formatSlot("2026-10-20T01:30:00.000Z")).toBe("10月20日周二 14:30");
    expect(soonDay("2026-10-17T10:30:00.000Z", now)).toBe("今天"); // 23:30 the same day
    expect(soonDay("2026-10-17T11:30:00.000Z", now)).toBe("明天"); // 00:30 the next day
    expect(soonDay("2026-10-19T01:00:00.000Z", now)).toBeNull();
  });
});

describe("the employer's invitation", () => {
  it("takes any number of times, earliest first, without repeats", () => {
    const result = parseInvite(
      {
        slots: ["2026-10-21T22:15:00.000Z", "2026-10-20T01:30:00.000Z", "2026-10-21T22:15:00.000Z"],
        mode: "video",
        place: "  Zoom 链接见附言 ",
        note: "带上简历",
      },
      now,
    );
    expect(result).toEqual({
      ok: true,
      invite: {
        slots: ["2026-10-20T01:30:00.000Z", "2026-10-21T22:15:00.000Z"],
        callFirst: false,
        mode: "video",
        place: "Zoom 链接见附言",
        note: "带上简历",
      },
    });
  });

  it("can give no time at all: 电话联系后再定", () => {
    expect(parseInvite({ callFirst: true, slots: ["2026-10-20T01:30:00.000Z"], mode: "nope" }, now)).toEqual({
      ok: true,
      invite: { slots: [], callFirst: true, mode: null, place: "", note: "" },
    });
  });

  it("refuses a time already past, no time without 电话再定, and nonsense", () => {
    expect(parseInvite({ slots: ["2026-10-16T01:00:00.000Z"] }, now)).toEqual({
      ok: false,
      error: "10月16日周五 14:00 已经过去了，请换一个时间",
    });
    expect(parseInvite({ slots: [] }, now)).toMatchObject({
      ok: false,
      error: expect.stringContaining("电话联系后再定"),
    });
    expect(parseInvite({ slots: ["tomorrow"] }, now)).toMatchObject({ ok: false });
    expect(parseInvite(null, now)).toMatchObject({ ok: false });
    expect(
      parseInvite({ slots: Array.from({ length: 21 }, (_, i) => `2026-11-${10 + i}T01:00:00.000Z`) }, now),
    ).toEqual({
      ok: false,
      error: "最多给 20 个时间",
    });
  });
});

describe("the job seeker's answer", () => {
  it("confirms one of the times given, while it is still ahead", () => {
    expect(parseResponse({ kind: "confirm", slot: "2026-10-20T01:30:00.000Z" }, view(), now)).toEqual({
      ok: true,
      response: { kind: "confirm", slot: "2026-10-20T01:30:00.000Z" },
    });
    expect(parseResponse({ kind: "confirm", slot: "2026-10-22T01:30:00.000Z" }, view(), now).ok).toBe(false);
    expect(
      parseResponse({ kind: "confirm", slot: "2026-10-20T01:30:00.000Z" }, view(), Date.parse("2026-10-21")).ok,
    ).toBe(false);
  });

  it("agrees to wait for the call, declines, or says what suits in their own words", () => {
    expect(parseResponse({ kind: "confirm" }, view({ callFirst: true, slots: [] }), now)).toEqual({
      ok: true,
      response: { kind: "confirm", slot: null },
    });
    expect(parseResponse({ kind: "decline", reply: " 已经找到工作了 " }, view(), now)).toEqual({
      ok: true,
      response: { kind: "decline", reply: "已经找到工作了" },
    });
    expect(parseResponse({ kind: "counter", reply: "" }, view(), now)).toEqual({
      ok: false,
      error: "写一句你方便的时间",
    });
    expect(parseResponse({ kind: "counter", reply: "周四下午都可以" }, view(), now).ok).toBe(true);
  });

  it("answers only an open invitation", () => {
    expect(parseResponse({ kind: "decline" }, view({ status: "cancelled" }), now)).toMatchObject({ ok: false });
    expect(parseResponse({ kind: "confirm", slot: null }, view({ status: "confirmed" }), now)).toMatchObject({
      ok: false,
    });
  });
});

describe("how each side reads it", () => {
  it("states the facts on each side", () => {
    expect(seekerInterviewStatus(view())).toBe("邀请你面试，请选一个时间");
    expect(whenText(view({ slots: ["2026-10-20T01:30:00.000Z", "2026-10-21T22:15:00.000Z"] }))).toBe(
      "10月20日周二 14:30、10月22日周四 11:15",
    );
    const confirmed = view({ status: "confirmed", chosenSlot: "2026-10-20T01:30:00.000Z" });
    expect(seekerInterviewStatus(confirmed)).toBe("面试已确认：10月20日周二 14:30");
    expect(employerInterviewStatus(confirmed)).toBe("对方已确认：10月20日周二 14:30");
    expect(employerInterviewStatus(view({ status: "counter", reply: "周四下午" }))).toBe(
      "对方说这些时间不行：「周四下午」",
    );
    expect(seekerInterviewStatus(view({ status: "confirmed", callFirst: true, slots: [] }))).toBe(
      "已同意，等雇主电话约时间",
    );
    expect(whenText(view({ callFirst: true, slots: [] }))).toBe("电话联系后再定");
  });

  it("puts on the to-do list what waits for that side, and interviews today or tomorrow", () => {
    expect(interviewTodo(view(), "seeker", "川味小馆「前厅服务员」", now)).toEqual({
      title: "待确认的面试：川味小馆「前厅服务员」",
      detail: "10月20日周二 14:30",
    });
    expect(interviewTodo(view(), "employer", "林晓", now)?.title).toBe("待确认的面试：林晓");
    expect(interviewTodo(view({ status: "counter", reply: "周四" }), "employer", "林晓", now)?.title).toBe(
      "林晓回了方便的时间",
    );
    expect(interviewTodo(view({ status: "counter" }), "seeker", "川味小馆", now)).toBeNull();
    const tomorrow = view({ status: "confirmed", chosenSlot: "2026-10-17T20:00:00.000Z" });
    expect(interviewTodo(tomorrow, "seeker", "川味小馆", now)).toEqual({
      title: "明天的面试：川味小馆",
      detail: "10月18日周日 09:00",
    });
    expect(
      interviewTodo(view({ status: "confirmed", chosenSlot: "2026-10-25T01:00:00.000Z" }), "seeker", "x", now),
    ).toBeNull();
    expect(interviewTodo(view({ status: "declined" }), "employer", "林晓", now)).toBeNull();
  });
});

describe("the calendar file", () => {
  it("has the start in UTC, the place and the note, escaped and folded, and no made-up end", () => {
    const ics = interviewIcs({
      uid: "abc",
      start: "2026-10-20T01:30:00.000Z",
      title: "面试: 前厅服务员, 川味小馆",
      mode: "in_person",
      place: "12 Queen St; Auckland",
      note: "带上简历".repeat(10),
      stamp: "2026-10-17T01:00:00.000Z",
    });
    expect(ics).toContain("DTSTART:20261020T013000Z\r\n");
    expect(ics).toContain("SUMMARY:面试: 前厅服务员\\, 川味小馆\r\n");
    expect(ics).toContain("LOCATION:12 Queen St\\; Auckland\r\n");
    expect(ics).not.toContain("DTEND");
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(ics.replace(/\r\n /g, "")).toContain(`DESCRIPTION:到店面试\\n${"带上简历".repeat(10)}`);
  });

  it("names the kind of interview in the page's language", () => {
    const ics = interviewIcs({
      uid: "abc",
      start: "2026-10-20T01:30:00.000Z",
      title: "Interview",
      mode: "in_person",
      place: "",
      note: "",
      stamp: "2026-10-17T01:00:00.000Z",
      lang: "en",
    });
    expect(ics).toContain(`DESCRIPTION:${interviewModeName("in_person", "en")}\r\n`);
    expect(ics).not.toContain("到店");
  });
});
