import { describe, expect, it } from "vitest";
import type { Exchange } from "@/lib/chat-consent";
import { workspaceTodos, type TodoInput } from "./todos";

const NOW = Date.parse("2026-10-15T00:00:00Z");
const DAY = 86_400_000;
const payload = { title: "联系方式", fields: [{ label: "电话", value: "021 000 000" }] };
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

  it("ignores jobs for job seekers", () => {
    const todos = workspaceTodos({
      ...base,
      jobs: [{ id: "j", titleZh: "j", status: "active", expiresAt: new Date(NOW + DAY).toISOString() }],
    });
    expect(todos).toEqual([]);
  });
});
