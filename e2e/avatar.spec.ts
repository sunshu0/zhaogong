import { expect, test } from "@playwright/test";
import { publishJob, signUpEmployer, uniqueTitle } from "./employer/helpers";

const AVATAR =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

test("profile avatar upload persists and appears on employer job cards and public home", async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem("zhaogong:session")) return;
    localStorage.setItem(
      "zhaogong:session",
      JSON.stringify({ email: "avatar@example.com", activeRole: "seeker", signedInAt: "2026-10-13" }),
    );
    const scope = JSON.stringify(["avatar@example.com", "employer", "e3"]);
    localStorage.setItem(
      "zhaogong:profiles-by-identity",
      JSON.stringify({
        [scope]: {
          name: "东区亚洲超市",
          contactName: "",
          headline: "零售招聘",
          location: "Botany",
          languages: "普通话",
          availability: "工作日",
          bio: "欢迎加入",
          avatar: "",
        },
      }),
    );
  });
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "我的求职主页" })).toBeVisible();
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: Buffer.from(AVATAR.split(",")[1], "base64") });
  await expect(page.getByRole("img", { name: "头像预览" })).toBeVisible();
  await page.getByRole("button", { name: "保存资料" }).click();
  await page.reload();
  await expect(page.getByRole("img", { name: "头像预览" })).toBeVisible();

  await page.evaluate((avatar) => {
    const key = "zhaogong:profiles-by-identity";
    const stored = JSON.parse(localStorage.getItem(key)!);
    const profiles = stored.identities ?? stored; // versioned since A23
    profiles[JSON.stringify(["avatar@example.com", "employer", "e3"])] = {
      name: "东区亚洲超市",
      contactName: "",
      headline: "零售招聘",
      location: "Botany",
      languages: "普通话",
      availability: "工作日",
      bio: "欢迎加入",
      avatar,
    };
    localStorage.setItem(key, JSON.stringify(stored));
    localStorage.setItem(
      "zhaogong:session",
      JSON.stringify({
        email: "avatar@example.com",
        activeRole: "seeker",
        employerId: "e3",
        employerName: "东区亚洲超市",
        signedInAt: "2026-10-13",
      }),
    );
  }, AVATAR);
  await page.goto("/jobs");
  const job = page.locator("article").filter({ has: page.locator('a[href="/jobs/j5"]') });
  await expect(job.getByRole("img", { name: "东区亚洲超市头像" })).toBeVisible();
  await page.goto("/jobs/j5");
  const employer = page.getByRole("region", { name: "雇主", exact: true });
  await expect(employer.getByRole("img", { name: "东区亚洲超市头像" })).toBeVisible();
  await expect(employer).not.toContainText("雇主ID"); // A29: name, badge and its explanation only
  await page.goto("/employers/e3");
  await expect(page.getByRole("img", { name: "东区亚洲超市头像" }).first()).toBeVisible();
  await expect(page.getByText("雇主主页 · 演示企业 · ID：e3", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("employer uploads and removes an avatar without changing the seeker avatar", async ({ page }, testInfo) => {
  const shop = await signUpEmployer(page, testInfo);
  const title = uniqueTitle("头像验收岗位", testInfo);
  await publishJob(page, title);
  await page.goto("/profile");
  await page
    .getByLabel("选择头像图片")
    .setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: Buffer.from(AVATAR.split(",")[1], "base64") });
  await expect(page.getByRole("img", { name: "头像预览" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("img", { name: "头像预览" })).toBeVisible();
  await page.getByRole("link", { name: "查看公开主页", exact: true }).click();
  await expect(page.getByRole("img", { name: `${shop}头像` }).first()).toBeVisible();
  await expect(
    page
      .locator("article")
      .filter({ has: page.getByRole("link", { name: new RegExp(title) }) })
      .getByRole("img", { name: `${shop}头像` }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page
    .getByRole("banner")
    .getByRole("button", { name: /^账号菜单/ })
    .click();
  await page.getByRole("button", { name: "切换为求职者", exact: true }).click();
  await page.goto("/profile");
  await expect(page.getByRole("img", { name: "头像预览" })).toHaveCount(0);
  await page.getByLabel("选择头像图片").setInputFiles({
    name: "personal.png",
    mimeType: "image/png",
    buffer: Buffer.from(AVATAR.split(",")[1], "base64"),
  });
  await expect(page.getByRole("img", { name: "头像预览" })).toBeVisible();
  await page
    .getByRole("banner")
    .getByRole("button", { name: /^账号菜单/ })
    .click();
  await page.getByRole("button", { name: `切换为雇主（${shop}）`, exact: true }).click();
  await page.goto("/profile");
  await expect(page.getByRole("img", { name: "头像预览" })).toBeVisible();
  await page.getByRole("button", { name: "移除头像", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("img", { name: "头像预览" })).toHaveCount(0);
  await page
    .getByRole("banner")
    .getByRole("button", { name: /^账号菜单/ })
    .click();
  await page.getByRole("button", { name: "切换为求职者", exact: true }).click();
  await page.goto("/profile");
  await expect(page.getByRole("img", { name: "头像预览" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
