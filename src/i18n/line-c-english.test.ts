import { describe, expect, it } from "vitest";
import { describeAction, moderatorLabel, ruleLabel } from "@/app/[lang]/admin/moderation";
import { waitText } from "@/app/[lang]/admin/moderation-stats";
import { profileChecklist } from "@/components/account/profile-checklist";
import { workspaceTodos } from "@/components/account/todos";
import { resendLabel } from "@/components/seeker/code-resend";
import { identityLabel, openErrorMessage, parseBusinessChoice } from "@/components/seeker/identity";
import { dayLabel, factLines, payLabel, sourceLine } from "@/lib/external-jobs/labels";
import { approvalProblem, hideReasons, parseHide, parseNote } from "@/lib/external-jobs/review";
import { DELETED_ACCOUNT } from "@/lib/deleted-account";
import type { ModerationLogEntry } from "@/lib/types";

// Round 20 step 2 (#236): line C's helpers say it in English when asked, and in Chinese as before when not.

describe("sign-in in English", () => {
  it("names the identity, explains a failed set-up and checks the business step", () => {
    const session = { email: "a@example.com", activeRole: "employer", employerName: "Dumpling House" } as const;
    expect(identityLabel(session as never, "en")).toBe("Employer · Dumpling House");
    expect(openErrorMessage("taken", "en")).toMatch(/^A team already runs this business/);
    expect(parseBusinessChoice({ kind: "new", name: " " }, "NZ", "en")).toEqual({
      ok: false,
      error: "Enter the business name",
    });
    expect(resendLabel(42, "en")).toBe("New code in 42 s");
  });
});

describe("the moderation log in English", () => {
  const base = { id: "a1", at: "2026-10-12T01:00:00Z", jobTitle: "Kitchen hand", employerName: "Dumpling House" };

  it("says what was done, to which job and why, with the moderator's note kept as written", () => {
    expect(
      describeAction(
        { ...base, action: "take_down", reasons: ["charges_fee", "fake_job"] } as ModerationLogEntry,
        "en",
      ),
    ).toBe("Took down “Kitchen hand” (Dumpling House) · Reported: Fake job, Charges a fee or deposit for the job");
    expect(describeAction({ ...base, action: "approve", rules: ["min_wage"] } as ModerationLogEntry, "en")).toBe(
      "Approved “Kitchen hand” (Dumpling House) · Flagged: Below the adult minimum wage",
    );
    expect(describeAction({ ...base, action: "ban", takenDown: 1 } as ModerationLogEntry, "en")).toBe(
      "Banned the employer “Dumpling House” and took down 1 job",
    );
    expect(describeAction({ ...base, action: "verify_reject", note: "电话打不通" } as ModerationLogEntry, "en")).toBe(
      "Rejected business verification for “Dumpling House” · 电话打不通",
    );
  });

  it("says 低于成人最低工资 in Chinese now (导师决定 3)", () => {
    expect(ruleLabel("min_wage")).toBe("低于成人最低工资");
    expect(ruleLabel("unknown_rule", "en")).toBe("unknown_rule");
  });

  it("names who acted, and how long things waited", () => {
    expect(moderatorLabel(undefined, "en")).toBe("(an older entry, moderator not recorded)");
    expect(moderatorLabel(DELETED_ACCOUNT, "en")).toBe("A deleted moderator");
    expect([waitText(20_000, "en"), waitText(60_000, "en"), waitText(26 * 3_600_000, "en")]).toEqual([
      "under a minute",
      "1 minute",
      "1 day 2 hours",
    ]);
    expect(waitText(25 * 60_000)).toBe("25 分钟");
  });
});

describe("external jobs in English", () => {
  const facts = {
    field: "software",
    kind: null,
    location: "Auckland, New Zealand",
    city: "auckland",
    closesAt: "2026-11-20T10:00:00.000Z",
    minYears: 0,
    degree: "bachelor",
    degreeSubjects: ["computer_science"],
    visa: ["no_sponsorship"],
    pay: { minCents: 9_500_000, maxCents: 11_000_000, currency: "NZD", period: "year" },
  } as const;

  it("labels the facts, states the posting's visa line as the posting's, and keeps the money as posted", () => {
    const rows = Object.fromEntries(factLines(facts as never, "en").map((l) => [l.label, l.value]));
    expect(rows).toEqual({
      Field: "Software",
      Type: "Not stated",
      Location: "Auckland (posting: Auckland, New Zealand)",
      Closes: "21 Nov 2026",
      Experience: "None needed",
      Degree: "Bachelor's · Computer science",
      Visa: "The posting says: no visa sponsorship",
      Pay: "$95,000–$110,000 NZD a year",
    });
    expect(payLabel({ minCents: 3000, currency: "NZD", period: "hour" }, "en")).toBe("From $30 NZD an hour");
    expect(dayLabel("2026-10-16T20:00:00.000Z", "en")).toBe("17 Oct");
    expect(sourceLine("Rocket Lab", "2026-10-16T20:00:00.000Z", "en")).toBe(
      "External job · From Rocket Lab's site · Checked on 17 Oct",
    );
  });

  it("checks a moderator's input in English", () => {
    expect(hideReasons("en").wrong_field).toBe("Not a software or electrical and electronic role");
    expect(parseHide("other", " ", "en")).toEqual({ ok: false, error_zh: "With “Other”, say why." });
    expect(parseNote("", "en")).toEqual({ ok: false, error_zh: "Say why." });
    expect(approvalProblem({ removedAt: "2026-10-01", flags: [] }, false, "en")).toBe(
      "This job has been taken down and can't be approved.",
    );
  });
});

describe("我的 in English", () => {
  it("names what a profile lacks, and the things to do", () => {
    const missing = profileChecklist({} as never, true, undefined, "en")
      .filter((item) => item.key)
      .map((item) => item.label);
    expect(missing).toEqual(["About the business", "Area", "Business verification", "Hiring contact"]);
    const todos = workspaceTodos({
      isEmployer: true,
      conversations: [],
      unread: {},
      exchanges: {},
      jobs: [],
      now: 0,
      profileMissing: { count: 5, labels: ["Area", "Photo", "Languages", "Skills", "Name"] },
      verification: { status: "rejected", rejectReason: "phone_unreachable" },
      lang: "en",
    });
    expect(todos.map((t) => [t.title, t.detail])).toEqual([
      [
        "Business verification didn't go through",
        "Couldn't reach anyone by phone. Fix your details and send them again.",
      ],
      ["Business page: 5 things missing", "Area, Photo, Languages and more"],
    ]);
  });
});
