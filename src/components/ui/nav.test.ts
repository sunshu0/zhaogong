import { describe, expect, it } from "vitest";
import {
  activeBottomKey,
  activeNavKey,
  bottomNavItems,
  headerItems,
  hidesBottomNav,
  navRole,
  showsPostJob,
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
    expect(labels(headerItems("out"))).toEqual(["找工作"]);
    expect(labels(headerItems("seeker"))).toEqual(["找工作", "聊天", "工作台"]);
    expect(labels(headerItems("employer"))).toEqual(["职位管理", "推荐人才", "聊天", "工作台"]);
    expect([showsPostJob("out"), showsPostJob("seeker"), showsPostJob("employer")]).toEqual([true, false, true]);
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
