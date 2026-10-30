import { describe, expect, it } from "vitest";
import {
  activeBottomKey,
  activeNavKey,
  bottomNavItems,
  headerItems,
  hidesBottomNav,
  navRole,
  showsPostJob,
  staffMayOpen,
  staffNext,
} from "./nav";

const labels = (items: { label: string }[]) => items.map((item) => item.label);

describe("navRole", () => {
  it("follows the session's active identity", () => {
    expect(navRole(null)).toBe("out");
    expect(navRole({ email: "a@b.co", signedInAt: "", activeRole: "seeker" })).toBe("seeker");
    expect(
      navRole({ email: "a@b.co", signedInAt: "", activeRole: "employer", employerId: "e1", employerName: "川味小馆" }),
    ).toBe("employer");
  });
});

describe("bottomNavItems", () => {
  it("gives each identity its own bar", () => {
    expect(labels(bottomNavItems("out"))).toEqual(["职位", "聊天", "我的"]);
    expect(labels(bottomNavItems("seeker"))).toEqual(["职位", "聊天", "我的"]);
    expect(labels(bottomNavItems("employer"))).toEqual(["职位管理", "发布", "聊天", "我的"]);
  });

  it("sends signed-out visitors through sign-in for 聊天 and 我的", () => {
    const [, chat, mine] = bottomNavItems("out");
    expect(chat.href).toBe("/login?next=%2Fmessages");
    expect(mine.href).toBe("/login?next=%2Faccount");
  });
});

describe("headerItems", () => {
  it("shows 聊天 only when signed in, and 发布招聘 only to visitors and employers", () => {
    expect(labels(headerItems("out"))).toEqual(["找工作", "实习", "专业职位"]);
    expect(labels(headerItems("seeker"))).toEqual(["找工作", "实习", "专业职位", "聊天", "工作台"]);
    expect(labels(headerItems("employer"))).toEqual(["职位管理", "推荐人才", "聊天", "工作台"]);
    expect([showsPostJob("out"), showsPostJob("seeker"), showsPostJob("employer")]).toEqual([true, false, true]);
  });

  it("marks a job section with no job yet and puts it last (user feedback 10-30 #4)", () => {
    const out = headerItems("out", undefined, ["internship"]);
    expect(labels(out)).toEqual(["找工作", "专业职位", "实习"]);
    expect(out.map((item) => Boolean(item.preparing))).toEqual([false, false, true]);
    expect(labels(headerItems("seeker", undefined, ["internship", "professional"]))).toEqual([
      "找工作",
      "聊天",
      "工作台",
      "实习",
      "专业职位",
    ]);
    expect(labels(headerItems("employer", undefined, ["professional"]))).toEqual([
      "职位管理",
      "推荐人才",
      "聊天",
      "工作台",
    ]);
  });
});

describe("activeNavKey", () => {
  it("matches a page to its entry", () => {
    expect(activeNavKey("/jobs")).toBe("jobs");
    expect(activeNavKey("/jobs/j1")).toBe("jobs");
    expect(activeNavKey("/employer/jobs")).toBe("manage");
    expect(activeNavKey("/employer/post")).toBe("post");
    expect(activeNavKey("/messages")).toBe("chat");
    expect(activeNavKey("/workspace")).toBe("workspace");
    expect(activeNavKey("/account")).toBe("mine");
    expect(activeNavKey("/profile")).toBe("mine");
    expect(activeNavKey("/me/saved")).toBe("mine");
    expect(activeNavKey("/me/alerts")).toBe("mine");
    expect(activeNavKey("/account/data")).toBe("mine"); // #76
    expect(activeNavKey("/")).toBeNull();
    expect(activeNavKey("/jobsearch")).toBeNull();
  });

  it("counts an external job and a business's page as 找工作, and the CV as 我的 (#263)", () => {
    // The job sections have header entries of their own (#376); the bottom bar keeps them under 职位.
    expect(activeNavKey("/internships")).toBe("internships");
    expect(activeNavKey("/professional")).toBe("professional");
    expect(activeBottomKey("/internships")).toBe("jobs");
    expect(activeBottomKey("/professional")).toBe("jobs");
    expect(activeNavKey("/external/ext-1")).toBe("jobs");
    expect(activeNavKey("/employers/e1")).toBe("jobs");
    expect(activeBottomKey("/employers/e1")).toBe("jobs");
    expect(activeNavKey("/profile/resume")).toBe("mine");
    // Not the employer's own pages, and not a look-alike path.
    expect(activeNavKey("/employer")).toBe("manage");
    expect(activeNavKey("/employer/team")).toBe("mine");
    expect(activeNavKey("/employer/photos")).toBe("mine");
    expect(activeNavKey("/externals")).toBeNull();
    // A shared CV and a candidate's page stay unmarked.
    expect(activeNavKey("/resume/r1")).toBeNull();
    expect(activeNavKey("/candidates/c1")).toBeNull();
  });

  it("puts workspace pages and 推荐人才 under 我的 in the bottom bar", () => {
    expect(activeBottomKey("/workspace")).toBe("mine");
    expect(activeBottomKey("/employer/candidates")).toBe("mine");
    expect(activeBottomKey("/messages")).toBe("chat");
  });
});

describe("hidesBottomNav", () => {
  it("hides the bar in focused flows only", () => {
    expect(hidesBottomNav("/login")).toBe(true);
    expect(hidesBottomNav("/employer/post")).toBe(true);
    expect(hidesBottomNav("/employer/jobs/j1")).toBe(true);
    expect(hidesBottomNav("/messages")).toBe(false);
    expect(hidesBottomNav("/employer/jobs")).toBe(false);
    expect(hidesBottomNav("/jobs/j1")).toBe(false);
  });
});

describe("a staff account (ADR 0043)", () => {
  const moderator = { email: "m@b.co", signedInAt: "", activeRole: "seeker" as const, staff: "moderator" as const };

  it("is offered 审核后台 and 我的 only, and no 发布招聘", () => {
    expect(navRole(moderator)).toBe("staff");
    expect(navRole({ ...moderator, activeRole: "employer", employerId: "e1", employerName: "川味小馆" })).toBe("staff");
    expect(bottomNavItems("staff").map((item) => [item.label, item.href])).toEqual([
      ["审核后台", "/admin"],
      ["我的", "/account"],
    ]);
    expect(headerItems("staff").map((item) => item.href)).toEqual(["/admin"]);
    expect(showsPostJob("staff")).toBe(false);
    expect(activeNavKey("/admin")).toBe("admin");
  });

  it("keeps the bottom bar on /admin, its home; others still go without it there", () => {
    expect(hidesBottomNav("/admin", "staff")).toBe(false);
    expect(hidesBottomNav("/admin", "seeker")).toBe(true);
    expect(hidesBottomNav("/admin")).toBe(true);
    expect(hidesBottomNav("/login", "staff")).toBe(true);
  });

  it("may stay on 审核后台, 我的, sign-in and the public pages; anything else sends it to /admin", () => {
    for (const page of ["/admin", "/account", "/login", "/about", "/safety", "/privacy", "/terms"])
      expect(staffMayOpen(page)).toBe(true);
    for (const page of ["/", "/jobs", "/jobs/j1", "/me", "/employer/post", "/account/data", "/messages", "/adminx"])
      expect(staffMayOpen(page)).toBe(false);
    expect(staffNext("/jobs")).toBe("/admin");
    expect(staffNext("/admin")).toBe("/admin");
    expect(staffNext("/safety?x=1")).toBe("/safety?x=1");
    expect(staffNext("/login?next=/jobs")).toBe("/admin");
  });
});
