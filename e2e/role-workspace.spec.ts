import { expect, test, type Page } from "@playwright/test";
import { chatEntry, exchangeTool, expectProfileSaved, freshEmail, openOptionalProfile, signIn } from "./helpers";
import AxeBuilder from "@axe-core/playwright";
import { publishJob, signUpEmployer, uniqueTitle } from "./employer/helpers";

async function switchRole(page: Page, name: string) {
  // Every page load checks the account with a Server Function; a navigation started while that is in flight can
  // be dropped by Next (the page stays put under load), so let it finish first.
  await page.waitForLoadState("networkidle");
  await page
    .getByRole("banner")
    .getByRole("button", { name: /^账号菜单/ })
    .click();
  await page.getByRole("button", { name, exact: true }).click();
  await expect(page).toHaveURL("/workspace");
}

test("one account keeps separate employer and seeker homes, messages, notifications and records", async ({
  page,
}, testInfo) => {
  const shop = await signUpEmployer(page, testInfo, undefined, { demo: true });
  const title = uniqueTitle("招聘记录服务员", testInfo);
  await publishJob(page, title);
  const entry = chatEntry(page);
  await page.goto("/profile");
  await expect(page.getByRole("heading", { level: 1, name: "企业主页" })).toBeVisible();
  await expect(page.getByLabel("企业名称", { exact: true })).toHaveValue(shop);
  await expect(page.getByLabel("可上班时间", { exact: true })).toHaveCount(0);
  await page.getByLabel("招聘联系人", { exact: true }).fill("陈经理");
  await page.getByLabel("企业介绍", { exact: true }).fill("我们提供前厅和厨房岗位。欢迎预约面试。");
  await expectProfileSaved(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("employer-profile.png"), fullPage: true });
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);

  await page.goto("/messages");
  await expect(entry).toHaveAttribute("title", "聊天，4 条未读消息");
  const contacts = page.getByRole("complementary", { name: "聊天列表" });
  await expect(contacts).not.toContainText("北岸早茶酒家");
  await contacts.getByRole("button", { name: /林晓/ }).click();
  await expect(await exchangeTool(page, "交换资料")).toBeVisible();
  await page.getByLabel("输入消息").fill("雇主专属消息：周五来面试。");
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await expect(entry).toHaveAttribute("title", "聊天，3 条未读消息");
  await page.goto("/notifications");
  await expect(page.getByRole("heading", { name: "招聘通知", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "全部标为已读" }).click();
  // An employer's records are 职位管理: /me goes there.
  await page.goto("/me");
  await expect(page).toHaveURL("/employer/jobs");
  await expect(page.getByRole("main")).toContainText(title);
  await expect(page.getByRole("region", { name: /最近看过的职位/ })).toHaveCount(0);

  await switchRole(page, "切换为求职者");
  await expect(page.getByRole("heading", { name: "求职者工作台", level: 1 })).toBeVisible();
  await expect(entry).toHaveAttribute("title", "聊天，3 条未读消息");
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "我的求职主页", level: 1 })).toBeVisible();
  await expect(page.getByLabel("企业名称", { exact: true })).toHaveCount(0);
  await page.getByLabel("称呼", { exact: true }).fill("求职者小林");
  await openOptionalProfile(page);
  await page.getByLabel("个人介绍", { exact: true }).fill("我的求职经历只保存在求职身份下。");
  await expectProfileSaved(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("seeker-profile.png"), fullPage: true });
  await page.goto("/messages");
  await expect(contacts).not.toContainText("陈雨");
  await contacts.getByRole("button", { name: /北岸早茶酒家/ }).click();
  await expect(page.getByRole("log")).not.toContainText("雇主专属消息");
  await page.getByLabel("输入消息").fill("求职专属消息：我可以上晚班。");
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await expect(entry).toHaveAttribute("title", "聊天，1 条未读消息");
  await page.goto("/notifications");
  await expect(page.getByRole("region", { name: "通知列表" })).toContainText("2 条未读");
  await page.getByRole("link", { name: /北岸早茶酒家回复了你/ }).click();
  await expect(page).toHaveURL("/messages?conversation=north-tea");
  await expect(page.getByRole("region", { name: "与北岸早茶酒家的聊天" })).toBeVisible();
  await page.goto("/jobs/j3");
  await expect(page.getByRole("heading", { name: "点心师傅", level: 1 })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const session = JSON.parse(localStorage.getItem("zhaogong:session")!);
        const scope = JSON.stringify([session.email, "seeker", null]);
        const records = JSON.parse(localStorage.getItem("zhaogong:viewed-jobs:identities") ?? "{}");
        return records[scope]?.some((record: { jobId: string }) => record.jobId === "j3") ?? false;
      }),
    )
    .toBe(true);
  await page.goto("/me");
  await expect(page.getByRole("region", { name: /最近看过的职位/ })).toContainText("点心师傅");
  await expect(page.getByRole("region", { name: "招聘记录", exact: true })).toHaveCount(0);

  await switchRole(page, `切换为雇主（${shop}）`);
  await expect(page.getByRole("heading", { name: "雇主工作台", level: 1 })).toBeVisible();
  await page.goto("/profile");
  await page.reload();
  await expect(page.getByLabel("招聘联系人", { exact: true })).toHaveValue("陈经理");
  await expect(page.getByLabel("企业介绍", { exact: true })).toHaveValue("我们提供前厅和厨房岗位。欢迎预约面试。");
  await page.goto("/notifications");
  await expect(page.getByRole("region", { name: "通知列表" })).toContainText("已全部读完");
  await page.goto("/messages");
  await expect(entry).toHaveAttribute("title", "聊天，3 条未读消息");
  await contacts.getByRole("button", { name: /林晓/ }).click();
  await expect(page.getByRole("log")).toContainText("雇主专属消息");
  await expect(page.getByRole("log")).not.toContainText("求职专属消息");

  await switchRole(page, "切换为求职者");
  await page.goto("/profile");
  await page.reload();
  await expect(page.getByLabel("称呼", { exact: true })).toHaveValue("求职者小林");
  await page.goto("/notifications");
  await expect(page.getByRole("region", { name: "通知列表" })).toContainText("1 条未读");
  await page.goto("/messages");
  await expect(entry).toHaveAttribute("title", "聊天，1 条未读消息");
  await contacts.getByRole("button", { name: /北岸早茶酒家/ }).click();
  await expect(page.getByRole("log")).toContainText("求职专属消息");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  // Someone else signs in on this browser (A12-1: a real sign-in; the server's session decides who it is).
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.removeItem("zhaogong:session"));
  await signIn(page, "/profile", freshEmail("demo.different-workspace"));
  await expect(page.getByLabel("称呼", { exact: true })).not.toHaveValue("求职者小林");
  await expect(entry).toHaveAttribute("title", "聊天，3 条未读消息");
  await page.goto("/me");
  await expect(page.getByRole("region", { name: /最近看过的职位/ })).toContainText("还没有看过职位");
  await page.goto("/notifications");
  await expect(page.getByRole("region", { name: "通知列表" })).toContainText("2 条未读");
});

test("changing identity in another tab clears the open thread and unsent draft", async ({ page }, testInfo) => {
  await signUpEmployer(page, testInfo, "/messages", { demo: true });
  const contacts = page.getByRole("complementary", { name: "聊天列表" });
  await contacts.getByRole("button", { name: /林晓/ }).click();
  await page.getByLabel("输入消息").fill("不可带到求职身份的草稿");
  await page.evaluate(() => {
    const key = "zhaogong:session";
    const session = JSON.parse(localStorage.getItem(key)!);
    localStorage.setItem(key, JSON.stringify({ ...session, activeRole: "seeker" }));
    window.dispatchEvent(new StorageEvent("storage", { key }));
  });
  await expect(page.getByRole("heading", { name: "求职聊天", level: 1 })).toBeVisible();
  await contacts.getByRole("button", { name: /北岸早茶酒家/ }).click();
  await expect(page.getByLabel("输入消息")).toHaveValue("");
  await expect(page.getByRole("log")).not.toContainText("不可带到求职身份的草稿");
});
