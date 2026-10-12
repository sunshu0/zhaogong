import { expect, test } from "@playwright/test";

test("intro page: what we are, three points, newest jobs and a smaller employer part", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("找工 · 奥克兰的中文工作平台");
  await expect(page.getByRole("heading", { level: 1, name: "奥克兰的中文工作平台" })).toBeVisible();
  for (const point of ["时薪、地区、签证一目了然", "雇主验证，发布前查违规", "登录后才显示联系方式"]) {
    await expect(page.getByText(point, { exact: true }).filter({ visible: true })).toBeVisible();
  }

  const newest = page.getByRole("region", { name: "最新职位" });
  const cards = newest.getByRole("listitem").getByRole("link");
  await expect(cards).toHaveCount(3);
  const employer = page.getByRole("region", { name: "招人？一分钟发布招聘" });
  await expect(employer.getByRole("link", { name: "雇主发布招聘 →" })).toHaveAttribute("href", "/employer");
  expect((await employer.boundingBox())!.y).toBeGreaterThan((await newest.boundingBox())!.y);

  await cards.first().click();
  await expect(page).toHaveURL(/\/jobs\/j\d+$/);
  await page.goBack();
  await newest.getByRole("link", { name: /^查看全部 \d+ 个职位/ }).click();
  await expect(page).toHaveURL("/jobs");
});

test("注册 goes through 注册或登录 and lands on the job list", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "注册", exact: true }).click();
  await expect(page).toHaveURL("/login?next=%2Fjobs");
  await expect(page.getByRole("heading", { level: 1, name: "注册或登录" })).toBeVisible();

  await page.getByLabel("邮箱", { exact: true }).fill("new.seeker@example.com");
  await page.getByRole("button", { name: "获取验证码" }).click();
  await expect(page.getByText("输入任意 6 位数字即可注册或登录").filter({ visible: true })).toBeVisible();
  await page.getByLabel("验证码").fill("135790");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL("/jobs");
  await expect(page.getByRole("banner").getByRole("link", { name: "我的" })).toBeVisible();
});

test("直接浏览工作 opens the job list; the logo leads back to the intro", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "直接浏览工作" }).click();
  await expect(page).toHaveURL("/jobs");
  await expect(page.getByRole("heading", { level: 1, name: "奥克兰中文工作" })).toBeVisible();
  await page.getByRole("banner").getByRole("link", { name: "找工", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1, name: "奥克兰的中文工作平台" })).toBeVisible();
});
