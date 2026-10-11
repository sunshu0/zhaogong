import { expect, test } from "@playwright/test";
import { contactBlock } from "./helpers";

test("contact details stay hidden until sign-in, then show on the same job", async ({ page }) => {
  const response = await page.goto("/jobs/j1");
  const html = await response!.text();
  expect(html).not.toContain("021 555 0101");
  expect(html).not.toContain("demo_chuanwei");

  await expect(contactBlock(page)).toContainText("登录后可以查看雇主的电话、微信。");
  await contactBlock(page).getByRole("link", { name: "登录查看联系方式" }).click();
  await expect(page).toHaveURL("/login?next=%2Fjobs%2Fj1");

  await page.getByLabel("邮箱", { exact: true }).fill("not-an-email");
  await page.getByRole("button", { name: "获取验证码" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("请输入正确的邮箱地址");

  await page.getByLabel("邮箱", { exact: true }).fill("E2E.Seeker@Example.com");
  await page.getByRole("button", { name: "获取验证码" }).click();
  await expect(page.getByText("验证码已发送到 e2e.seeker@example.com").filter({ visible: true })).toBeVisible();

  await page.getByLabel("验证码").fill("12345");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("请输入 6 位数字验证码");

  await page.getByLabel("验证码").fill("123456");
  await page.getByRole("button", { name: "登录", exact: true }).click();

  await expect(page).toHaveURL("/jobs/j1");
  await expect(contactBlock(page).getByRole("link", { name: "021 555 0101" })).toHaveAttribute("href", "tel:0215550101");
  await expect(contactBlock(page)).toContainText("demo_chuanwei");
  await expect(contactBlock(page)).toContainText("已登录：e2e.seeker@example.com");
  await expect(page.getByRole("banner").getByRole("link", { name: "我的" })).toBeVisible();
});

test("sign-in never sends the user to another site", async ({ page }) => {
  await page.goto("/login?next=//evil.example");
  await page.getByLabel("邮箱", { exact: true }).fill("e2e.seeker@example.com");
  await page.getByRole("button", { name: "获取验证码" }).click();
  await page.getByLabel("验证码").fill("000000");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL("/");
});
