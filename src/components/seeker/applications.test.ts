import { describe, expect, it } from "vitest";
import { candidateFacts } from "@/lib/candidate-matching";
import {
  NOTE_MAX,
  applicantCandidate,
  applicationProfileFrom,
  parseApplicationNote,
  parseApplicationProfile,
  parseDecision,
  seekerStatus,
} from "@/components/seeker/applications";
import type { Profile } from "@/components/seeker/hub-state";

describe("parseApplicationNote", () => {
  it("trims the note and allows up to 200 characters, counting Chinese characters as one", () => {
    expect(parseApplicationNote("  周末可以上班  ")).toEqual({ ok: true, note: "周末可以上班" });
    expect(parseApplicationNote(undefined)).toEqual({ ok: true, note: "" });
    expect(parseApplicationNote("好".repeat(NOTE_MAX))).toEqual({ ok: true, note: "好".repeat(NOTE_MAX) });
    expect(parseApplicationNote("好".repeat(NOTE_MAX + 1))).toEqual({ ok: false, error: "附言最多 200 字" });
  });
});

describe("parseApplicationProfile", () => {
  const page = {
    name: " 林晓 ",
    headline: "两年奶茶店经验",
    location: "市中心",
    languages: "普通话、英语",
    availability: "周末",
    bio: "做事细心。",
    avatar: "data:image/png;base64,AAAA",
    contactName: "林小姐",
    privateDetails: { phone: "021 555 0101", wechat: "linxiao", email: "lin@example.com" },
    resume: {
      candidateId: "abc",
      discoverable: true,
      skills: "收银、做奶茶",
      experienceYears: 2,
      employmentTypes: ["part_time", "nonsense"],
      regionIds: ["akl-cbd"],
      expectedMinPay: 25,
    },
  };

  it("keeps what the employer sees and drops contact details, the avatar and the resume's own ids", () => {
    const copy = parseApplicationProfile(page)!;
    expect(copy).toEqual({
      name: "林晓",
      headline: "两年奶茶店经验",
      location: "市中心",
      languages: "普通话、英语",
      availability: "周末",
      bio: "做事细心。",
      resume: {
        skills: "收银、做奶茶",
        experienceYears: 2,
        employmentTypes: ["part_time"],
        regionIds: ["akl-cbd"],
        expectedMinPay: 25,
      },
    });
    expect(JSON.stringify(copy)).not.toMatch(/021 555|linxiao|lin@example|林小姐|data:image|abc/);
    // The page as the browser keeps it, junk type included.
    expect(applicationProfileFrom(page as unknown as Profile)).toEqual(copy);
  });

  it("needs a name, cuts long text and survives junk", () => {
    expect(parseApplicationProfile({ ...page, name: "  " })).toBeNull();
    expect(parseApplicationProfile(null)).toBeNull();
    expect(parseApplicationProfile("林晓")).toBeNull();
    expect(parseApplicationProfile({ name: "林晓", bio: "长".repeat(2000), resume: 5 })!.bio).toHaveLength(600);
  });

  it("gives the five facts employers check first", () => {
    const facts = candidateFacts(applicantCandidate("a1", parseApplicationProfile(page)!));
    expect(facts.map((f) => f.value)).toEqual(["周末", "市中心", "$25 起", "普通话、英语", "2 年"]);
  });
});

describe("seekerStatus", () => {
  it("says whether the employer looked, and shows only 合适 as a decision", () => {
    expect(seekerStatus({})).toBe("已申请，等雇主查看");
    expect(seekerStatus({ seenAt: "2026-10-16T09:00:00Z" })).toBe("雇主已看过");
    expect(seekerStatus({ seenAt: "2026-10-16T09:00:00Z", decision: "unfit" })).toBe("雇主已看过");
    expect(seekerStatus({ decision: "unfit" })).toBe("雇主已看过");
    expect(seekerStatus({ seenAt: "2026-10-16T09:00:00Z", decision: "fit" })).toBe("雇主觉得合适");
  });
});

describe("parseDecision", () => {
  it("takes 合适, 不合适 or clearing, nothing else", () => {
    expect(parseDecision("fit")).toBe("fit");
    expect(parseDecision("unfit")).toBe("unfit");
    expect(parseDecision(null)).toBeNull();
    expect(parseDecision("maybe")).toBeUndefined();
  });
});
