import { describe, expect, it } from "vitest";
import { shareTexts } from "@/components/employer/share-texts";
import { MOCK_EMPLOYERS, MOCK_JOBS } from "@/mock/data";

const job = MOCK_JOBS.find((j) => j.id === "j1")!; // 前厅服务员, 川味小馆, part time, student visa, urgent, meals
const employer = MOCK_EMPLOYERS.find((e) => e.id === "e1")!;
const url = "https://zhaogong.example/jobs/j1";
const texts = shareTexts(job, employer, url);

describe("shareTexts", () => {
  it("makes a text for each platform, each ending with the job link and none with contact details", () => {
    for (const [platform, text] of Object.entries(texts)) {
      expect(text, platform).toContain(url);
      expect(text, platform).not.toContain(job.contact.phone!);
      expect(text, platform).not.toContain(job.contact.wechat!);
    }
  });

  it("keeps the WeChat group text short: title, place, pay, tags, link", () => {
    expect(texts.wechat).toBe(
      [
        "【招聘】前厅服务员 · 川味小馆（已验证企业）",
        "📍 Mt Eden / Dominion Rd",
        "💰 $25–27/小时 · 兼职 · 每周 15–25 小时",
        "🕒 周五至周日晚班",
        "✅ 急招 · 包餐 · 学签可做",
        `👉 详情和联系方式：${url}`,
      ].join("\n"),
    );
  });

  it("gives Xiaohongshu a title line and hashtags for the area, type, industry and visas", () => {
    const [title] = texts.xiaohongshu.split("\n");
    expect(title).toBe("奥克兰招聘｜前厅服务员 $25–27/小时");
    expect(texts.xiaohongshu).toMatch(/#奥克兰找工作 #奥克兰兼职 #奥克兰餐饮 #留学生兼职 #新西兰打工度假$/);
  });

  it("gives Skykiwi the full post in both languages, visas stated as the employer's facts", () => {
    expect(texts.skykiwi.split("\n").slice(0, 3)).toEqual([
      "[招聘] 前厅服务员 Front-of-house staff — Mt Eden / Dominion Rd — $25–27/小时",
      "",
      "雇主：川味小馆（已验证企业）",
    ]);
    expect(texts.skykiwi).toContain(`\n\n详情和联系方式：${url}`);
    expect(texts.skykiwi).toContain(job.descriptionZh);
    expect(texts.skykiwi).toContain(job.descriptionEn);
    expect(texts.skykiwi).toContain("雇主注明可接受的签证：公民 / 永居、开放工签、学签、打工度假");
    expect(texts.skykiwi).toContain("语言：普通话、英语");
  });

  it("leaves out what the job does not say and the badge of an unverified employer", () => {
    const bare = {
      ...job,
      hoursPerWeek: undefined,
      shiftsZh: undefined,
      urgent: false,
      mealsIncluded: false,
      visaAccepted: [],
    };
    const unverified = MOCK_EMPLOYERS.find((e) => e.verification === "unverified")!;
    const t = shareTexts(bare, unverified, url);
    expect(t.wechat).toBe(
      [
        `【招聘】前厅服务员 · ${unverified.name}`,
        "📍 Mt Eden / Dominion Rd",
        "💰 $25–27/小时 · 兼职",
        `👉 详情和联系方式：${url}`,
      ].join("\n"),
    );
    expect(t.skykiwi).not.toContain("签证");
    expect(t.skykiwi).not.toContain("福利");
    expect(t.skykiwi).not.toMatch(/\n\n\n/);
    expect(t.xiaohongshu).not.toContain("#留学生兼职");
  });

  it("does not promise contact details behind the link when the job keeps them private", () => {
    const t = shareTexts({ ...job, contactPublic: false, contact: {} }, employer, url);
    for (const [platform, text] of Object.entries(t)) {
      expect(text, platform).toContain(url);
      expect(text, platform).not.toContain("联系方式");
    }
    expect(t.wechat.split("\n").at(-1)).toBe(`👉 详情和在线沟通：${url}`);
    expect(t.xiaohongshu).toContain("职位详情看链接，可以在线和雇主沟通👇");
    expect(t.skykiwi).toContain(`\n\n详情和在线沟通：${url}`);
  });
});
