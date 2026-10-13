import { describe, expect, it } from "vitest";
import { isWeChat, shareSummary, withLink } from "@/components/seeker/share";
import { MOCK_JOBS } from "@/mock/data";
import type { Job } from "@/lib/types";

const job = (id: string): Job => MOCK_JOBS.find((j) => j.id === id)!;

describe("shareSummary", () => {
  it("gives title and pay, then region, type and tags", () => {
    expect(shareSummary(job("j1"))).toBe(
      "【前厅服务员】$25–27/小时\nMt Eden / Dominion Rd · 兼职 · 急招 · 包餐 · 学签可做",
    );
  });

  it("leaves out tags a job does not have", () => {
    expect(shareSummary(job("j8"))).toBe("【装修木工】$32–40/小时\nAlbany · 全职");
  });

  it("never includes contact details", () => {
    const text = shareSummary(job("j1"));
    expect(text).not.toContain("021");
    expect(text).not.toContain("demo_chuanwei");
  });
});

describe("withLink", () => {
  it("adds the link on its own line", () => {
    expect(withLink("【店长】$30–33/小时", "https://example.com/jobs/j14")).toBe(
      "【店长】$30–33/小时\n详情：https://example.com/jobs/j14",
    );
  });
});

describe("isWeChat", () => {
  it("recognises the WeChat in-app browser", () => {
    expect(isWeChat("Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Mobile/15E148 MicroMessenger/8.0.50 NetType/WIFI")).toBe(
      true,
    );
    expect(isWeChat("Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36")).toBe(false);
  });
});
