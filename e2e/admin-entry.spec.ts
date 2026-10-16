// #73: a moderator finds 审核后台 in the account menu (from 768 px) and on 我的; other accounts do not. The server
// decides who is a moderator.
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { signIn } from "./helpers";
import { moderatorPage } from "./employer/helpers";

/** Opens /admin the way a person would: the account menu from 768 px, 我的 on phones. */
async function openAdminEntry(page: Page, testInfo: TestInfo) {
  if (testInfo.project.name === "desktop") {
    await page.goto("/jobs");
    await page
      .getByRole("banner")
      .getByRole("button", { name: /^账号菜单/ })
      .click();
    await page.locator("#account-menu").getByRole("link", { name: "审核后台" }).click();
  } else {
    await page.goto("/account");
    await page.getByRole("link", { name: /审核后台/ }).click();
  }
  await expect(page).toHaveURL("/admin");
  await expect(page.getByRole("tab", { name: /发布时被标记/ })).toBeVisible();
}

/** Whether 审核后台 is offered, once the page has heard back from the server. */
async function offersAdmin(page: Page, testInfo: TestInfo): Promise<boolean> {
  if (testInfo.project.name === "desktop") {
    await page.goto("/jobs");
    await page.waitForLoadState("networkidle");
    await page
      .getByRole("banner")
      .getByRole("button", { name: /^账号菜单/ })
      .click();
    return (await page.locator("#account-menu").getByRole("link", { name: "审核后台" }).count()) > 0;
  }
  await page.goto("/account");
  await expect(page.getByRole("link", { name: /数据与账号/ })).toBeVisible();
  await page.waitForLoadState("networkidle");
  return (await page.getByRole("link", { name: /审核后台/ }).count()) > 0;
}

test("the demo moderator opens 审核后台 from the account menu or 我的", async ({ browser }, testInfo) => {
  const moderator = await moderatorPage(browser, testInfo);
  await openAdminEntry(moderator, testInfo);
  await moderator.context().close();
});

test("only a moderator is offered 审核后台; signing in from /login?next=/admin lands on /admin", async ({
  page,
  browser,
}, testInfo) => {
  // Signed in from /admin's own sign-in link: back on /admin, refused, and nothing in the menu.
  const email = await signIn(page, "/admin");
  await expect(page.getByText("只有审核员能使用审核后台。", { exact: true })).toBeVisible();
  expect(await offersAdmin(page, testInfo)).toBe(false);

  // Made a moderator: the entry shows up and leads in.
  const admin = await moderatorPage(browser, testInfo);
  await admin.goto("/admin");
  await admin.getByRole("tab", { name: "审核员" }).click();
  await admin.getByLabel("邮箱").fill(email);
  await admin.getByRole("button", { name: "添加", exact: true }).click();
  await expect(admin.getByRole("status")).toHaveText(`已处理：添加审核员 ${email}`);
  await openAdminEntry(page, testInfo);

  // No longer a moderator: gone again.
  await admin.getByRole("button", { name: `移除审核员 ${email}` }).click();
  await expect(admin.getByRole("status")).toHaveText(`已处理：移除审核员 ${email}`);
  await admin.context().close();
  expect(await offersAdmin(page, testInfo)).toBe(false);
});
