import { expect, test } from "@playwright/test";
import { freshEmail, openOptionalProfile, signIn } from "./helpers";

// A12-1: a real sign-in (a session written into localStorage is cleared by the server).
test.beforeEach(async ({ page }) => {
  await signIn(page, "/profile", freshEmail("demo.profile")); // starts with 林晓's demo page (#125)
});

test("我的主页: preview first, completeness counts the key items, optional fields folded, saved as you type", async ({
  page,
}) => {
  await page.goto("/profile");
  const preview = page.getByRole("region", { name: "别人看到的样子" });
  await expect(preview).toContainText("林晓");
  await expect(preview.getByRole("definition").nth(2)).toHaveText("待补充"); // 期望时薪
  await expect(page.getByRole("heading", { name: "资料完成度 6/10" })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "资料完成度" })).toHaveAttribute("aria-valuenow", "6");
  await expect(page.getByText("改动会自动保存到你的账号。")).toBeVisible();
  await expect(page.getByRole("button", { name: "保存资料" })).toHaveCount(0);

  await page.getByLabel("期望时薪（NZ$ / 小时起）").fill("26");
  await expect(page.getByText("已保存到你的账号")).toBeVisible();
  await expect(preview).toContainText("$26 起");
  await expect(page.getByRole("heading", { name: "资料完成度 7/10" })).toBeVisible();

  // Optional fields are folded until asked for.
  await expect(page.getByLabel("工作技能")).toBeHidden();
  await openOptionalProfile(page);
  await page.getByLabel("工作技能").fill("收银");
  await expect(page.getByRole("heading", { name: "资料完成度 8/10" })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("期望时薪（NZ$ / 小时起）")).toHaveValue("26");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("a save the browser refuses says so instead of 已保存", async ({ page }) => {
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: /资料完成度/ })).toBeVisible();
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
  });
  await page.getByLabel("可上班时间").fill("周末");
  await expect(page.getByText(/没有保存：这个浏览器不让本站保存资料/)).toBeVisible();
  await expect(page.getByText("已保存到你的账号")).toHaveCount(0);
});

test("a real account starts with an empty page (#125)", async ({ browser }) => {
  // Its own browser: the beforeEach signed `page` in with a demo account.
  const page = await (await browser.newContext()).newPage();
  await signIn(page, "/profile", freshEmail("real.seeker"));
  await expect(page.getByLabel("称呼", { exact: true })).toHaveValue("");
  await expect(page.getByRole("region", { name: "别人看到的样子" })).not.toContainText("林晓");
  await page.context().close();
});
