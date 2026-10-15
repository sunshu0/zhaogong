import { expect, test } from "@playwright/test";
import { contactBlock } from "./helpers";

test("public contact details: shown after sign-in, never in the page HTML; the chat stays available", async ({
  page,
}) => {
  const response = await page.goto("/jobs/j1"); // 川味小馆 made its contact details public
  const html = await response!.text();
  expect(html).not.toContain("021 555 0101");
  expect(html).not.toContain("demo_chuanwei");

  await expect(contactBlock(page)).toContainText("登录后可以查看雇主的电话、微信。");
  await expect(page.getByRole("main").getByRole("link", { name: "立即沟通", exact: true })).toBeVisible();
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
  await expect(contactBlock(page)).toContainText("021 555 0101");
  await expect(contactBlock(page)).toContainText("demo_chuanwei");
  await expect(page.getByRole("button", { name: "立即沟通", exact: true })).toBeVisible();
  await expect(page.getByRole("banner").getByRole("button", { name: "账号菜单，当前身份：求职者" })).toBeVisible();
});

test("private contact details: only exchanged in the chat, signed in or not", async ({ page }) => {
  await page.goto("/jobs/j2");
  await expect(contactBlock(page)).toContainText("雇主没有公开联系方式");
  await expect(contactBlock(page).getByRole("link", { name: "登录查看联系方式" })).toHaveCount(0);
  await page.getByRole("main").getByRole("link", { name: "立即沟通", exact: true }).click();
  await expect(page).toHaveURL("/login?role=seeker&next=%2Fjobs%2Fj2");
  await page.getByLabel("邮箱", { exact: true }).fill("e2e.private@example.com");
  await page.getByRole("button", { name: "获取验证码" }).click();
  await page.getByLabel("验证码").fill("123456");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL("/jobs/j2");
  await expect(contactBlock(page)).toContainText("雇主没有公开联系方式");
  await expect(page.getByRole("button", { name: "立即沟通", exact: true })).toBeVisible();
});

test("sign-in never sends the user to another site", async ({ page }) => {
  await page.goto("/login?next=//evil.example");
  await page.getByLabel("邮箱", { exact: true }).fill("e2e.seeker@example.com");
  await page.getByRole("button", { name: "获取验证码" }).click();
  await page.getByLabel("验证码").fill("000000");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL("/jobs");
});
