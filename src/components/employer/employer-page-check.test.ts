import { describe, expect, it } from "vitest";
import { checkEmployerPage } from "@/components/employer/employer-page-check";

describe("checkEmployerPage (#195)", () => {
  it("lets a plain page through", () => {
    expect(
      checkEmployerPage({ name: "川味小馆", bio: "家常川菜，欢迎会普通话的同事加入。", contactName: "王经理" }),
    ).toEqual([]);
  });

  it("refuses fees, visa selling and ethnic preference, naming the field and the words", () => {
    const findings = checkEmployerPage({ bio: "入职交押金。", headline: "包签工作", languages: "只招华人" });
    expect(findings.map((f) => f.field)).toEqual(["headline", "bio", "languages"]);
    expect(findings[0].message_zh).toContain("招聘简介含有");
    expect(findings[1].message_zh).toMatch(/^企业介绍含有「押金」：不能向求职者收取/);
    expect(findings[2].message_zh).toContain("需会普通话");
  });

  it("refuses contact details anywhere on the page: it is public, signed out too", () => {
    const findings = checkEmployerPage({
      bio: "欢迎加入，加微信 shop_wx_2026 了解详情",
      contactName: "陈经理 09 055 0101",
      availability: "邮件 jobs@example.com",
    });
    expect(findings.map((f) => f.field)).toEqual(["bio", "contactName", "availability"]);
    expect(findings[0].message_zh).toContain("企业介绍写了联系方式（shop_wx_2026）");
    expect(findings[1].message_zh).toContain("09 055 0101");
    expect(findings[2].message_zh).toContain("jobs@example.com");
  });

  it("does not read the photo", () => {
    expect(checkEmployerPage({ avatar: "data:image/png;base64,QUJD" })).toEqual([]);
  });
});
