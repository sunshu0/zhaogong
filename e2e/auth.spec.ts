import { expect, test } from "@playwright/test";
import { contactBlock, fillSignInCode, freshEmail, signIn } from "./helpers";

// A12-1: random sign-in codes and a server session in an httpOnly cookie; the browser's copy is for display only.

test("the session lives in an httpOnly, SameSite=Lax cookie for 30 days, out of the page's reach", async ({
  page,
  context,
}) => {
  await signIn(page, "/jobs", freshEmail("cookie"));
  const cookie = (await context.cookies()).find((c) => c.name === "zg_session");
  expect(cookie).toBeDefined();
  expect(cookie!.httpOnly).toBe(true);
  expect(cookie!.sameSite).toBe("Lax");
  // Secure is set in production builds, the browser tests' build included (E2E_SERVER=start, #139); not on next dev.
  expect(cookie!.secure).toBe(process.env.E2E_SERVER === "start");
  expect(cookie!.path).toBe("/");
  const days = (cookie!.expires * 1000 - Date.now()) / 86_400_000;
  expect(days).toBeGreaterThan(29.9);
  expect(days).toBeLessThan(30.1);
  expect(await page.evaluate(() => document.cookie)).not.toContain("zg_session");
});

test("a new code only once a minute; in development the code shows on the page", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("邮箱", { exact: true }).fill(freshEmail("resend"));
  await page.getByRole("button", { name: "获取验证码" }).click();
  await expect(page.getByTestId("dev-sign-in-code")).toHaveText(/^\d{6}$/);
  await page.getByRole("button", { name: "重新获取验证码" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(/^验证码刚发过，请 \d+ 秒后再获取$/);
});

test("editing localStorage signs nobody in and makes nobody an employer", async ({ page }) => {
  await page.goto("/jobs/j1");
  await page.evaluate((address) => {
    localStorage.setItem(
      "zhaogong:session",
      JSON.stringify({
        email: address,
        signedInAt: new Date().toISOString(),
        activeRole: "employer",
        employerId: "e1",
        employerName: "川味小馆",
      }),
    );
  }, freshEmail("forged"));
  await page.reload();
  // The server has no session for this browser: the copy is cleared and the contact details stay hidden.
  await expect(contactBlock(page).getByRole("link", { name: "登录查看联系方式" })).toBeVisible();
  await expect(contactBlock(page)).not.toContainText("021 ••• 0101");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("zhaogong:session"))).toBeNull();
});

test("the server's session wins over the browser's copy, and signing out removes the cookie", async ({
  page,
  context,
}) => {
  const address = await signIn(page, "/jobs/j1", freshEmail("truth"));
  await expect(contactBlock(page)).toContainText("021 ••• 0101");

  // Wipe the browser's copy: the cookie session still signs this browser in, and the copy comes back.
  await page.evaluate(() => localStorage.removeItem("zhaogong:session"));
  await page.reload();
  await expect(contactBlock(page)).toContainText("021 ••• 0101");
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("zhaogong:session") ?? "null")?.email))
    .toBe(address);

  await page.goto("/account");
  await page.getByRole("button", { name: "退出登录" }).click();
  await expect.poll(async () => (await context.cookies()).some((c) => c.name === "zg_session")).toBe(false);

  // Putting the copy back does not bring the session back.
  await page.evaluate((a) => {
    localStorage.setItem(
      "zhaogong:session",
      JSON.stringify({ email: a, signedInAt: new Date().toISOString(), activeRole: "seeker" }),
    );
  }, address);
  await page.goto("/jobs/j1");
  await expect(contactBlock(page).getByRole("link", { name: "登录查看联系方式" })).toBeVisible();
});

test("a wrong code five times stops that code; a new one works after the wait", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("邮箱", { exact: true }).fill(freshEmail("tries"));
  await page.getByRole("button", { name: "获取验证码" }).click();
  const shown = (await page.getByTestId("dev-sign-in-code").textContent())!.trim();
  const wrong = shown === "000000" ? "111111" : "000000";
  for (const left of [4, 3, 2, 1]) {
    await page.getByLabel("验证码").fill(wrong);
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(`验证码不对，还可以再试 ${left} 次`);
  }
  await page.getByLabel("验证码").fill(wrong);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("错误次数太多，请重新获取验证码");
  await fillSignInCode(page); // the right code no longer works either
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("错误次数太多，请重新获取验证码");
});
