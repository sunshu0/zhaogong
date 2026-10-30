import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

// User feedback 10-30 #1: on the demo site (no mail service, or only invited accounts), a visitor learns that
// signing in is closed before pressing 立即沟通, 收藏 or 发布招聘. The browser tests' build always sends codes, so the
// cookie zg_e2e_sign_in_notice stands in for the server's answer (src/lib/auth/notice.ts).
async function asIf(page: import("@playwright/test").Page, baseURL: string | undefined, notice: "closed" | "invited") {
  await page.context().addCookies([{ name: "zg_e2e_sign_in_notice", value: notice, url: baseURL! }]);
}

test("says signing in is closed on every page and above 立即沟通, before anything is pressed", async ({
  page,
  baseURL,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/jobs/j2");
  await expect(page.locator("[data-sign-in-notice]")).toHaveCount(0);
  const barBefore = await page.getByRole("link", { name: "立即沟通", exact: true }).boundingBox();

  await asIf(page, baseURL, "closed");
  await page.goto("/jobs/j2");
  const notes = page.locator("[data-sign-in-notice]");
  await expect(notes.first()).toHaveText(
    "演示站暂时不能登录：可以看职位和企业主页，但不能联系雇主、收藏职位或发布招聘。",
  );
  await expect(notes.nth(1)).toHaveText("演示站暂时不能登录，所以还不能联系雇主。");
  await expect(notes.nth(1)).toBeInViewport();
  const top = await notes.first().boundingBox();
  const barNote = await notes.nth(1).boundingBox();
  const chat = await page.getByRole("link", { name: "立即沟通", exact: true }).boundingBox();
  // A21's way: the heights at 375 px, written down in the report. The bar is fixed to the bottom, so 立即沟通 stays
  // where it was and the bar grows upwards by its note's line.
  console.log(
    `[measure 375] top note ${top!.height}px; bar note ${barNote!.height}px; 立即沟通 at y ${barBefore!.y} → ${chat!.y}`,
  );
  expect(barNote!.height).toBeLessThanOrEqual(48);
  expect(chat!.y).toBeGreaterThanOrEqual(barBefore!.y - 1);

  // The job list's cards stay as they were: the note is said once, at the top.
  await page.goto("/jobs");
  await expect(notes).toHaveCount(1);
  await expect(page.getByRole("main").locator("[data-sign-in-notice]")).toBeVisible();
});

test("by invitation only: says so, and an invited account signs in as usual; the note is gone then", async ({
  page,
  baseURL,
}) => {
  await asIf(page, baseURL, "invited");
  await page.goto("/");
  await expect(page.locator("[data-sign-in-notice]")).toHaveText(
    "演示站暂时只开放给受邀账号：其他人可以看职位和企业主页，但不能联系雇主、收藏职位或发布招聘。",
  );
  await signIn(page, "/jobs/j2");
  await expect(page.getByRole("button", { name: "立即沟通", exact: true })).toBeVisible();
  await expect(page.locator("[data-sign-in-notice]")).toHaveCount(0);
});
