import { expect, test } from "@playwright/test";
import { contactBlock, fillSignInCode, freshEmail, signIn, siteNav } from "./helpers";

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

  const address = freshEmail("E2E.Seeker");
  await page.getByLabel("邮箱", { exact: true }).fill(address);
  await page.getByRole("button", { name: "获取验证码" }).click();
  await expect(page.getByText(`验证码已发送到 ${address.toLowerCase()}`).filter({ visible: true })).toBeVisible();

  await page.getByLabel("验证码").fill("12345");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("请输入 6 位数字验证码");

  // A12-1: a wrong code is refused on the server, with the tries left.
  const shown = (await page.getByTestId("dev-sign-in-code").textContent())!.trim();
  await page.getByLabel("验证码").fill(shown === "000000" ? "111111" : "000000");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("验证码不对，还可以再试 4 次");

  await fillSignInCode(page);
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
  await page.getByLabel("邮箱", { exact: true }).fill(freshEmail("e2e.private"));
  await page.getByRole("button", { name: "获取验证码" }).click();
  await fillSignInCode(page);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL("/jobs/j2");
  await expect(contactBlock(page)).toContainText("雇主没有公开联系方式");
  await expect(page.getByRole("button", { name: "立即沟通", exact: true })).toBeVisible();
});

test("sign-in never sends the user to another site", async ({ page }) => {
  await page.goto("/login?next=//evil.example");
  await page.getByLabel("邮箱", { exact: true }).fill(freshEmail());
  await page.getByRole("button", { name: "获取验证码" }).click();
  await fillSignInCode(page);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL("/jobs");
});

// #109: a signed-in visit to /login?next=… goes straight on, so 我的 lands on /account whenever it is tapped.
test("signed in, /login?next= goes straight on to a page on this site, and only on this site", async ({ page }) => {
  await signIn(page, "/jobs");
  await page.goto("/login?next=%2Faccount");
  await expect(page).toHaveURL("/account");
  await page.goto("/login?next=https%3A%2F%2Fevil.example");
  await expect(page).toHaveURL(/\/login\?next=https/);
  await expect(page.getByText("你已登录：")).toBeVisible();
  await page.goto("/login");
  await expect(page.getByText("你已登录：")).toBeVisible();
});

test("signed in, 我的 on the phone lands on /account before and after the page is ready", async ({
  page,
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "the bottom bar is the phone's");
  await signIn(page, "/jobs");
  await page.goto("/");
  await siteNav(page).getByRole("link", { name: "我的", exact: true }).click();
  await expect(page).toHaveURL("/account");

  // Before the page's script runs, 我的 still points at sign-in (the server cannot tell from the page alone).
  const bare = await browser.newContext({
    ...testInfo.project.use,
    storageState: await page.context().storageState(),
    javaScriptEnabled: false,
  });
  const early = await bare.newPage();
  await early.goto("/");
  await siteNav(early).getByRole("link", { name: "我的", exact: true }).click();
  await expect(early).toHaveURL("/account");
  await bare.close();
});
