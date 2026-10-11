import { expect, type Page } from "@playwright/test";

/** Signs in through /login like a user would: any email, then any six-digit code. */
export async function signIn(page: Page, next: string, email = "e2e.seeker@example.com") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("邮箱", { exact: true }).fill(email);
  await page.getByRole("button", { name: "获取验证码" }).click();
  await page.getByLabel("验证码").fill("123456");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(next);
}

/** The visible contact block on a job page. */
export function contactBlock(page: Page) {
  return page.getByRole("region", { name: "联系方式" });
}
