import { describe, expect, it } from "vitest";
import { posterLabel, sameContact, staleContactNote } from "@/components/employer/job-poster";

describe("posterLabel (#182)", () => {
  it("names the teammate who posted, and says when it was you only in a team", () => {
    expect(posterLabel({ kind: "teammate", name: "小李" }, 2)).toBe("小李发布");
    expect(posterLabel({ kind: "you" }, 3)).toBe("你发布的");
    expect(posterLabel({ kind: "you" }, 1)).toBeNull();
  });

  it("says when the poster left the team or deleted the account", () => {
    expect(posterLabel({ kind: "left", email: "lee@example.com" }, 1)).toBe("lee@example.com发布（已离开团队）");
    expect(posterLabel({ kind: "deleted" }, 2)).toBe("已删除的账号发布");
  });

  it("says nothing for a job from before posters were recorded", () => {
    expect(posterLabel(undefined, 4)).toBeNull();
  });
});

describe("sameContact (#186)", () => {
  it("is the same choice with the same details, whatever the order or blank fields", () => {
    const a = { contactPublic: true, contact: { phone: "09 055 0101", wechat: "wx" } };
    expect(sameContact(a, { contactPublic: true, contact: { wechat: "wx ", phone: "09 055 0101", email: "" } })).toBe(
      true,
    );
    expect(sameContact(a, { contactPublic: true, contact: { phone: "09 055 0101", wechat: "wx2" } })).toBe(false);
    expect(sameContact(a, { contactPublic: false, contact: a.contact })).toBe(false);
  });
});

describe("staleContactNote (#186)", () => {
  it("warns while job seekers can still reach the job, naming who filled the contact", () => {
    for (const phase of ["active", "ending", "pending_review", "timed_out"] as const)
      expect(staleContactNote({ kind: "left", email: "lee@example.com" }, phase)).toContain(
        "已离开团队的 lee@example.com",
      );
    expect(staleContactNote({ kind: "deleted" }, "active")).toContain("一个已删除的账号");
  });

  it("says nothing when the contact is a teammate's, or the job is down or ended", () => {
    expect(staleContactNote(undefined, "active")).toBeNull();
    expect(staleContactNote({ kind: "deleted" }, "removed")).toBeNull();
    expect(staleContactNote({ kind: "left", email: "lee@example.com" }, "closed")).toBeNull();
  });
});
