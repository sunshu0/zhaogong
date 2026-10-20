import { describe, expect, it } from "vitest";
import { applicantsLabelZh, cardActions, cardNumbers } from "@/components/employer/job-card";
import { MOCK_JOBS } from "@/mock/data";

const NOW = Date.UTC(2026, 9, 15);
const day = 86_400_000;
const job = {
  ...MOCK_JOBS[0],
  status: "active" as const,
  postedAt: new Date(NOW - 3 * day).toISOString(),
  expiresAt: new Date(NOW + 27 * day).toISOString(),
};

describe("cardNumbers", () => {
  it("shows views, chats, and contact views when the details are public", () => {
    expect(cardNumbers({ ...job, contactPublic: true }, { views: 12, chats: 2, contactViews: 5 })).toEqual([
      "12 次浏览",
      "2 人聊过",
      "5 次查看联系方式",
    ]);
  });

  it("says details are swapped in chat when they are private", () => {
    expect(cardNumbers({ ...job, contactPublic: false }, { views: 0, chats: 0, contactViews: 5 })).toEqual([
      "0 次浏览",
      "还没有人聊过",
      "不公开 · 聊天交换",
    ]);
  });
});

describe("cardActions", () => {
  const keys = (a: ReturnType<typeof cardActions>) => a.more.map((m) => m.key);

  it("gives a live job one main button, 查看, and the rest under 更多", () => {
    const a = cardActions(job, NOW, { asking: undefined, sharing: false });
    expect(a.main).toEqual({ label: "查看", href: `/jobs/${job.id}` });
    expect(keys(a)).toEqual(["edit", "renew", "refresh", "share", "copy", "close"]);
    expect(a.more.find((m) => m.key === "renew")).toMatchObject({ label: "续期", disabled: false });
    expect(a.more.find((m) => m.key === "refresh")).toMatchObject({ label: "刷新", disabled: false });
    expect(a.more.find((m) => m.key === "close")).toMatchObject({ label: "结束招聘", danger: true });
  });

  it("names why a job cannot be refreshed, and the share toggle follows the panel", () => {
    const fresh = { ...job, postedAt: new Date(NOW - 1000).toISOString() };
    const a = cardActions(fresh, NOW, { asking: undefined, sharing: true });
    expect(a.more.find((m) => m.key === "refresh")).toMatchObject({ label: "今天已刷新过", disabled: true });
    expect(a.more.find((m) => m.key === "share")?.label).toBe("收起文案");
  });

  it("lets an ended job be renewed for 14 days, record hires, and still be viewed (#69)", () => {
    const ended = { ...job, status: "expired" as const, expiresAt: new Date(NOW - 2 * day).toISOString() };
    const a = cardActions(ended, NOW, { asking: undefined, sharing: false });
    expect(a.main.label).toBe("查看");
    expect(a.more.map((m) => m.label)).toEqual(["编辑", "续期", "复制为新职位", "记录招到几人"]);
    const corrected = cardActions({ ...ended, hiresConfirmed: 2 }, NOW, { asking: undefined, sharing: false });
    expect(corrected.more.at(-1)?.label).toBe("更正招到人数");
  });

  it("offers 重新发布 instead once a job closed more than 14 days ago (#69)", () => {
    const old = { ...job, expiresAt: new Date(NOW - 20 * day).toISOString() };
    const a = cardActions(old, NOW, { asking: undefined, sharing: false });
    expect(a.more.map((m) => m.label)).toEqual(["编辑", "重新发布", "记录招到几人"]);
  });

  it("names why a live job cannot be renewed", () => {
    const far = { ...job, expiresAt: new Date(NOW + 80 * day).toISOString() };
    const a = cardActions(far, NOW, { asking: undefined, sharing: false });
    expect(a.more.find((m) => m.key === "renew")).toMatchObject({
      label: "截止日最远到 90 天后，现在不用续期",
      disabled: true,
    });
  });

  it("makes 编辑 the main button while a job waits for review (job seekers cannot open it yet)", () => {
    const waiting = { ...job, status: "pending_review" as const };
    const a = cardActions(waiting, NOW, { asking: undefined, sharing: false });
    expect(a.main).toEqual({ label: "编辑", href: `/employer/jobs/${job.id}` });
    expect(keys(a)).toEqual(["refresh", "close"]);
    expect(a.more[0]).toMatchObject({ label: "审核通过后才能刷新", disabled: true });
  });

  it("offers 复制为新职位 for a live or ended job, never for one taken down or waiting for review (#190)", () => {
    expect(cardActions(job, NOW, { asking: undefined, sharing: false }).more.at(-1)?.key).toBe("close");
    const removed = { ...job, status: "removed" as const };
    expect(keys(cardActions(removed, NOW, { asking: undefined, sharing: false }))).not.toContain("copy");
    const waiting = { ...job, status: "pending_review" as const };
    expect(keys(cardActions(waiting, NOW, { asking: undefined, sharing: false }))).not.toContain("copy");
  });

  it("hides 结束招聘 and the hires item while a question is already open", () => {
    expect(keys(cardActions(job, NOW, { asking: "close", sharing: false }))).not.toContain("close");
  });
});

describe("applicantsLabelZh (#84)", () => {
  it("counts applications and says how many are new", () => {
    expect(applicantsLabelZh(undefined)).toBe("聊过的人 0");
    expect(applicantsLabelZh({ total: 0, unseen: 0 })).toBe("聊过的人 0");
    expect(applicantsLabelZh({ total: 3, unseen: 1 })).toBe("聊过的人 3 · 1 个新申请");
    expect(applicantsLabelZh({ total: 2, unseen: 0 })).toBe("聊过的人 2");
  });
});
