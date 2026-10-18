import { expect, test } from "@playwright/test";
import { chatMenuItem, expectProfileSaved, fillSignInCode, openOptionalProfile } from "./helpers";
import AxeBuilder from "@axe-core/playwright";
import { publishJob, signUpEmployer, uniqueTitle } from "./employer/helpers";

test("seeker finds company jobs and credentials, signs in and initiates a persistent job-specific chat", async ({
  page,
}, testInfo) => {
  await page.goto("/jobs/j1");
  await expect(page.getByRole("main").getByRole("link", { name: "立即沟通", exact: true })).toBeVisible();
  await page
    .getByRole("region", { name: "雇主", exact: true })
    .getByRole("link", { name: /^查看企业主页/ })
    .click();
  await expect(page).toHaveURL("/employers/e1");
  await expect(page.getByRole("heading", { name: "川味小馆", exact: true })).toBeVisible();
  const credentials = page.getByRole("region", { name: "公司资质", exact: true });
  await expect(credentials).toContainText("9429000000001");
  await expect(credentials).toContainText("Demo Sichuan Kitchen Limited");
  const jobs = page.getByRole("region", { name: /在招岗位/ });
  await expect(jobs.getByRole("link", { name: /^前厅服务员/ })).toBeVisible();
  await expect(jobs.getByRole("link", { name: /^厨房帮工/ })).toBeVisible();
  await expect(jobs).not.toContainText("点心师傅");
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("company-public.png"), fullPage: true });
  if (testInfo.project.name === "desktop") {
    for (const width of [1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`company-${width}.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 1280, height: 800 });
  }
  // j1's own item: the list is newest first, and the demo data has newer jobs of 川味小馆 (#88).
  const j1 = jobs.getByRole("listitem").filter({ has: page.locator('a[href="/jobs/j1"]') });
  await j1.getByRole("link", { name: "立即沟通", exact: true }).click();
  await expect(page).toHaveURL("/login?role=seeker&next=%2Fjobs%2Fj1");
  await page
    .getByLabel("邮箱", { exact: true })
    .fill(`public-seeker.${testInfo.project.name}.${Date.now()}@example.com`);
  await page.getByRole("button", { name: "获取验证码" }).click();
  await fillSignInCode(page);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL("/jobs/j1");
  await page.getByRole("button", { name: "立即沟通", exact: true }).click();
  await expect(page).toHaveURL(/conversation=employer%3Ae1%3Aj1/);
  await expect(page.getByRole("log")).toContainText("尚未发送消息");
  await page.getByLabel("输入消息").fill("您好，我想应聘前厅服务员。");
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("log")).toContainText("我想应聘前厅服务员");
  await (await chatMenuItem(page, "企业主页")).click();
  await expect(page).toHaveURL("/employers/e1");
  await j1.getByRole("button", { name: "立即沟通", exact: true }).click();
  await expect(page.getByRole("log")).toContainText("我想应聘前厅服务员");
  await page.goto("/messages");
  await expect(
    page.getByRole("complementary", { name: "聊天列表" }).getByRole("button", { name: /川味小馆/ }),
  ).toHaveCount(1);
  await page.goto("/jobs/j2");
  await page.getByRole("button", { name: "立即沟通", exact: true }).click();
  await expect(page.getByRole("log")).toContainText("尚未发送消息");
  await expect(page.getByRole("log")).not.toContainText("我想应聘前厅服务员");
});

test("employer edits a public company home and chat remains in the seeker identity", async ({ page }, testInfo) => {
  const shop = await signUpEmployer(page, testInfo);
  const title = uniqueTitle("企业主页服务员", testInfo);
  await publishJob(page, title);
  await page.goto("/profile");
  await page.getByLabel("企业介绍", { exact: true }).fill("公开企业介绍：欢迎前厅同事加入。");
  await page.getByLabel("地区", { exact: true }).fill("测试门店地址，预约到店前请沟通。");
  await page.getByLabel("招聘联系人", { exact: true }).fill("陈经理");
  await expectProfileSaved(page);
  await page.getByRole("link", { name: "查看公开主页", exact: true }).click();
  await expect(page.getByRole("heading", { name: shop, exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/employers\//);
  const companyUrl = page.url();
  await expect(page.getByRole("region", { name: "企业介绍", exact: true })).toContainText("公开企业介绍");
  await expect(page.getByRole("region", { name: "企业介绍", exact: true })).toContainText("陈经理");
  await expect(page.getByRole("region", { name: /在招岗位/ })).toContainText(title);
  await expect(page.getByRole("region", { name: "公司资质", exact: true })).toContainText("还没有完成企业验证");
  await expect(page.getByRole("link", { name: "管理本企业职位", exact: true })).toBeVisible();
  await page
    .getByRole("banner")
    .getByRole("button", { name: /^账号菜单/ })
    .click();
  await page.getByRole("button", { name: "切换为求职者", exact: true }).click();
  await page.goto("/profile");
  await openOptionalProfile(page);
  await page.getByLabel("个人介绍", { exact: true }).fill("不可公开到企业主页的个人简历");
  await page.goto(companyUrl);
  await expect(page.getByRole("main")).not.toContainText("不可公开到企业主页");
  await page
    .getByRole("banner")
    .getByRole("button", { name: /^账号菜单/ })
    .click();
  await page.getByRole("button", { name: `切换为雇主（${shop}）`, exact: true }).click();
  await page.goto("/jobs/j1");
  await page.getByRole("button", { name: "切换为求职者", exact: true }).click();
  await page.getByRole("button", { name: "立即沟通", exact: true }).click();
  await page.getByLabel("输入消息").fill("求职者发起的主动私聊");
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await page
    .getByRole("banner")
    .getByRole("button", { name: /^账号菜单/ })
    .click();
  await page.getByRole("button", { name: `切换为雇主（${shop}）`, exact: true }).click();
  await page.goto("/messages");
  await expect(page.getByRole("complementary", { name: "聊天列表" })).not.toContainText("川味小馆");
  // Signed out (A12-1: the server session too, not only the browser's copy).
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.removeItem("zhaogong:session"));
  await page.goto(companyUrl);
  await expect(page.getByRole("region", { name: "企业介绍", exact: true })).toContainText("公开企业介绍");
  await expect(page.getByRole("link", { name: "编辑企业主页", exact: true })).toHaveCount(0);
});

test("expired jobs cannot start chats and empty or missing companies have clear states", async ({ page }, testInfo) => {
  await page.goto("/jobs/j17");
  await expect(page.getByText("招聘已结束", { exact: true })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "立即沟通", exact: true })).toHaveCount(0);
  await page
    .getByRole("region", { name: "雇主", exact: true })
    .getByRole("link", { name: /^查看企业主页/ })
    .click();
  await expect(page.getByRole("region", { name: /在招岗位/ })).not.toContainText("收银员");
  await signUpEmployer(page, testInfo, "/profile");
  await page.getByRole("link", { name: "查看公开主页", exact: true }).click();
  await expect(page.getByText("该雇主暂时没有招聘中的职位。")).toBeVisible();
  await page.goto("/employers/missing-employer");
  await expect(page.getByRole("heading", { name: "这个雇主不存在或已停用", exact: true })).toBeVisible();
});
