import { describe, expect, it } from "vitest";
import type { Exchange } from "@/lib/chat-consent";
import { workspaceTodos, type TodoInput } from "./todos";

const NOW = Date.parse("2026-10-15T00:00:00Z");
const DAY = 86_400_000;
const payload = { title: "联系方式", fields: [{ label: "电话", value: "09 000 000" }] };
const exchange = (over: Partial<Exchange>): Exchange => ({
  id: "x1",
  kind: "contact",
  from: "them",
  status: "pending",
  offered: payload,
  createdAt: "2026-10-14T00:00:00Z",
  ...over,
});
const base: TodoInput = {
  isEmployer: false,
  conversations: [
    { id: "north-tea", person: "北岸早茶酒家" },
    { id: "clean-home", person: "家政公司" },
  ],
  unread: {},
  exchanges: {},
  now: NOW,
  profileMissing: { count: 0, labels: [] },
};

describe("workspaceTodos", () => {
  it("is empty when nothing needs doing", () => {
    expect(workspaceTodos(base)).toEqual([]);
  });

  it("puts requests waiting for consent first, then unread chats, then the profile", () => {
    const todos = workspaceTodos({
      ...base,
      unread: { "north-tea": 2, "clean-home": 0 },
      exchanges: { "clean-home": [exchange({})] },
      profileMissing: { count: 4, labels: ["期望时薪", "经验", "头像", "技能"] },
    });
    expect(todos.map((todo) => todo.title)).toEqual([
      "家政公司想和你交换联系方式",
      "北岸早茶酒家发来 2 条新消息",
      "资料还差 4 项",
    ]);
    expect(todos[0].href).toBe("/messages?conversation=clean-home");
    expect(todos[2]).toMatchObject({ href: "/profile", detail: "期望时薪、经验、头像 等" });
  });

  it("puts interviews after unread chats and before the profile (#103)", () => {
    const todos = workspaceTodos({
      ...base,
      unread: { "north-tea": 1 },
      interviews: [{ id: "interview:i1", title: "明天的面试：川味小馆「前厅服务员」", detail: "", href: "/me/saved" }],
      profileMissing: { count: 1, labels: ["经验"] },
    });
    expect(todos.map((todo) => todo.title)).toEqual([
      "北岸早茶酒家发来 1 条新消息",
      "明天的面试：川味小馆「前厅服务员」",
      "资料还差 1 项",
    ]);
  });

  it("skips requests you sent and ones already answered", () => {
    const todos = workspaceTodos({
      ...base,
      exchanges: {
        "north-tea": [exchange({ from: "me" }), exchange({ id: "x2", status: "accepted" })],
      },
    });
    expect(todos).toEqual([]);
  });

  it("gives employers jobs closing within 3 days or ran out and still renewable (#69), and jobs under review", () => {
    const job = (id: string, days: number, status: "active" | "pending_review" | "expired" = "active") => ({
      id,
      titleZh: id,
      status,
      expiresAt: new Date(NOW + days * DAY).toISOString(),
    });
    const todos = workspaceTodos({
      ...base,
      isEmployer: true,
      jobs: [
        job("厨师", 2.5),
        job("切配", 6),
        job("服务员", 0.5),
        job("洗碗工", 20),
        job("收银", 3, "pending_review"),
        job("旧职位", -2),
      ],
      profileMissing: { count: 1, labels: ["企业验证"] },
    });
    expect(todos.map((todo) => todo.title)).toEqual([
      "「旧职位」已截止",
      "「服务员」今天截止",
      "「厨师」3 天后截止",
      "「收银」审核中",
      "企业资料还差 1 项",
    ]);
  });

  it("gives employers each job's new applications, before closing jobs (#84)", () => {
    const job = (id: string, days = 20) => ({
      id,
      titleZh: id,
      status: "active" as const,
      expiresAt: new Date(NOW + days * DAY).toISOString(),
    });
    const todos = workspaceTodos({
      ...base,
      isEmployer: true,
      jobs: [job("厨师", 1), job("服务员"), job("收银")],
      unseenApplications: { 服务员: 2, 收银: 0 },
    });
    expect(todos.map((todo) => [todo.title, todo.detail, todo.href])).toEqual([
      ["2 个新申请", "「服务员」", "/employer/jobs/%E6%9C%8D%E5%8A%A1%E5%91%98/applicants"],
      ["「厨师」1 天后截止", expect.any(String), "/employer/jobs?tab=ending"],
    ]);
  });

  it("tells an employer about a rejected 企业验证 with its reason, and that a pending one is in hand (#78)", () => {
    const rejected = workspaceTodos({
      ...base,
      isEmployer: true,
      jobs: [],
      verification: { status: "rejected", rejectReason: "phone_unreachable" },
    });
    expect(rejected).toEqual([
      {
        id: "verification",
        title: "企业验证没有通过",
        detail: "电话核实不到人，改好资料重新提交",
        href: "/employer/verify",
      },
    ]);
    const pending = workspaceTodos({ ...base, isEmployer: true, jobs: [], verification: { status: "pending" } });
    expect(pending.map((t) => t.title)).toEqual(["企业验证审核中"]);
    expect(workspaceTodos({ ...base, isEmployer: true, jobs: [], verification: { status: "approved" } })).toEqual([]);
  });

  it("ignores jobs for job seekers", () => {
    const todos = workspaceTodos({
      ...base,
      jobs: [{ id: "j", titleZh: "j", status: "active", expiresAt: new Date(NOW + DAY).toISOString() }],
    });
    expect(todos).toEqual([]);
  });
});
