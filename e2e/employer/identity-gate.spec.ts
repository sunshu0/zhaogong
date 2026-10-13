import { expect, test } from "@playwright/test";
import { signIn } from "../helpers";
import { signUpEmployer } from "./helpers";

// Posting and managing jobs need the employer identity; the server decides, the session only shows it.

test("signed out, posting goes through employer sign-up and comes back", async ({ page }, testInfo) => {
  await page.goto("/employer/post");
  await expect(page).toHaveURL("/login?role=employer&next=%2Femployer%2Fpost");
  await signUpEmployer(page, testInfo); // the same sign-up, from its start, back to /employer/post
  await expect(page.getByRole("heading", { name: "和发帖助手一起写招聘" })).toBeVisible();
});

test("a signed-in job seeker without a business lands on the business step", async ({ page }, testInfo) => {
  await signIn(
    page,
    "/jobs",
    `e2e.b.seeker.${testInfo.project.name}${testInfo.workerIndex}${Date.now() % 1_000_000}@example.com`,
  );
  await page.goto("/employer/jobs");
  await expect(page).toHaveURL("/login?role=employer&next=%2Femployer%2Fjobs");
  await expect(page.getByRole("heading", { name: "开通雇主身份" })).toBeVisible();
  await expect(page.getByLabel("邮箱", { exact: true })).toHaveCount(0);
});

test("the employer intro stays open to everyone", async ({ page }) => {
  await page.goto("/employer");
  await expect(page.getByRole("heading", { name: "招中文员工，一分钟发好招聘" })).toBeVisible();
  await expect(page.getByRole("link", { name: "注册 / 登录" })).toHaveAttribute(
    "href",
    "/login?role=employer&next=%2Femployer",
  );
});

test("a hand-edited session that claims a business gets nothing from the server", async ({ page }) => {
  await page.goto("/jobs");
  await page.evaluate(() =>
    localStorage.setItem(
      "zhaogong:session",
      JSON.stringify({
        email: "not.an.owner@example.com",
        signedInAt: new Date().toISOString(),
        activeRole: "employer",
        employerId: "e1",
        employerName: "川味小馆",
      }),
    ),
  );
  await page.goto("/employer/jobs");
  // The account menu checks the account with the server and drops the business; the page then sends
  // the visitor to sign-up. Until then the server has given it no jobs.
  await expect(page).toHaveURL(/\/login\?role=employer&next=%2Femployer%2Fjobs/);
});

test("in the job-seeker identity, an employer page asks to switch instead of switching", async ({ page }, testInfo) => {
  const shop = await signUpEmployer(page, testInfo, "/employer/jobs");
  await page
    .getByRole("banner")
    .getByRole("button", { name: /^账号菜单/ })
    .click();
  await page.getByRole("button", { name: "切换为求职者" }).click();
  await expect(page).toHaveURL("/workspace");

  await page.goto("/employer/jobs");
  await expect(page.getByText("你现在用的是求职者身份").filter({ visible: true })).toBeVisible();
  await page.getByRole("button", { name: `切换为雇主（${shop}）` }).click();
  await expect(page.getByRole("heading", { name: "管理职位" })).toBeVisible();
});
