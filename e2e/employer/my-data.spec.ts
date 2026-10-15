// 数据与账号 (#54, R-30): export everything about the account as JSON, and delete the account.
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { jobCard, publishJob, searchJobList, signUpEmployer, uniqueTitle } from "./helpers";
import { fillSignInCode, signIn } from "../helpers";

async function signedInEmail(page: Page): Promise<string> {
  const email = await page.evaluate(() => JSON.parse(localStorage.getItem("zhaogong:session") ?? "{}").email);
  expect(email).toMatch(/@example\.com$/);
  return email;
}

async function openMyData(page: Page) {
  await page.goto("/account");
  await page.getByRole("link", { name: /数据与账号/ }).click();
  await expect(page).toHaveURL("/account/data");
  await expect(page.getByRole("heading", { name: "导出我的数据" })).toBeVisible();
}

test("an employer downloads their data, deletes the account, and the email signs up anew", async ({
  page,
}, testInfo) => {
  const shop = await signUpEmployer(page, testInfo);
  const title = uniqueTitle("导出删除", testInfo);
  await publishJob(page, title);
  const email = await signedInEmail(page);

  await openMyData(page);
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载我的数据" }).click();
  const file = await downloading;
  expect(file.suggestedFilename()).toMatch(/^zhaogong-my-data-\d{4}-\d{2}-\d{2}\.json$/);
  const data = JSON.parse(await readFile((await file.path())!, "utf8"));
  expect(data.format).toBe("zhaogong-my-data");
  expect(data.server.account.email).toBe(email);
  expect(data.server.employer.business.name).toBe(shop);
  expect(data.server.employer.jobs.map((j: { titleZh: string }) => j.titleZh)).toContain(title);
  expect(data.thisDevice["zhaogong:session"].email).toBe(email);
  await expect(page.getByRole("status").filter({ hasText: "已下载" })).toBeVisible();

  const remove = page.getByRole("button", { name: "永久删除账号" });
  const confirm = page.getByLabel(/输入你的登录邮箱/);
  await expect(remove).toBeDisabled();
  await confirm.fill("someone.else@example.com");
  await expect(remove).toBeDisabled();
  await confirm.fill(email.toUpperCase());
  await remove.click();

  await expect(page).toHaveURL("/account/data?deleted=1");
  await expect(page.getByText("账号已删除")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("zhaogong:session"))).toBeNull();

  // The job came down.
  await searchJobList(page, title);
  await expect(jobCard(page, title)).toHaveCount(0);

  // The same email is a new account: no employer identity any more.
  await page.goto("/login?next=%2Faccount");
  await page.getByLabel("邮箱", { exact: true }).fill(email);
  await page.getByRole("button", { name: "获取验证码" }).click();
  await fillSignInCode(page);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL("/account");
  await expect(page.getByRole("link", { name: "开通雇主身份" })).toBeVisible();
});

test("a job seeker's profile on this device goes with the account; signed out, the page asks to sign in", async ({
  page,
}) => {
  await page.goto("/account/data");
  await expect(page.getByText("登录后可以导出你的数据或删除账号")).toBeVisible();

  const email = await signIn(page, "/account/data");
  await page.evaluate((address) => {
    const scope = JSON.stringify([address, "seeker", null]);
    localStorage.setItem(
      "zhaogong:profiles-by-identity",
      JSON.stringify({ version: 2, identities: { [scope]: { name: "要删除的名字" }, other: { name: "别人" } } }),
    );
  }, email);
  await page.getByLabel(/输入你的登录邮箱/).fill(email);
  await page.getByRole("button", { name: "永久删除账号" }).click();
  await expect(page).toHaveURL("/account/data?deleted=1");
  const profiles = await page.evaluate(() => localStorage.getItem("zhaogong:profiles-by-identity"));
  expect(profiles).not.toContain("要删除的名字");
  expect(profiles).toContain("别人");
});
