// 时薪参考 (#85, R-36): on job pages and beside the pay in the post form, from the platform's own open jobs.
import { expect, test } from "@playwright/test";
import { CLEAN_MESSAGE, openTheForm, signUpEmployer } from "./employer/helpers";

test("a job page shows what open jobs of its industry pay, where it comes from, and when", async ({ page }) => {
  await page.goto("/jobs/j3"); // 点心师傅, 餐饮, Northcote: too few there, so all of Auckland
  const box = page.getByRole("region", { name: "同类职位时薪" });
  await expect(box).toContainText("全奥克兰 · 餐饮");
  for (const term of ["最低", "中位数", "最高"])
    await expect(box.getByRole("term").filter({ hasText: term })).toBeVisible();
  await expect(box).toContainText(/根据平台上 \d+ 个在招的餐饮职位计算/);
  await expect(box).toContainText("不含外部数据");
  await expect(box).not.toContainText(/签证|移民/);

  await page.goto("/jobs/j7"); // 发型助理: the only 美容美发 job
  await expect(page.getByRole("region", { name: "同类职位时薪" })).toContainText("样本太少");
});

test("the post form shows the reference beside the pay and hints below the median, without blocking", async ({
  page,
}, testInfo) => {
  await signUpEmployer(page, testInfo);
  await openTheForm(page);
  await page.getByLabel(/把微信群里的招聘消息粘贴进来/).fill(CLEAN_MESSAGE);
  await page.getByRole("button", { name: "整理成职位" }).click();
  const box = page.getByRole("region", { name: "同类职位时薪" });
  await expect(box).toContainText("餐饮");
  const pay = page.getByRole("group", { name: /^时薪/ });
  await pay.getByLabel("最高（可不填）").fill("");
  // The minimum wage itself: allowed, and below the median of 餐饮 jobs on the platform (demo jobs pay $24 or more).
  await pay.getByLabel("最低", { exact: true }).fill("23.95");
  await expect(box.getByRole("note")).toHaveText("低于同类职位的中位数，可能比较难招到人。");
  await page.getByRole("button", { name: "预览", exact: true }).click();
  await expect(page.getByRole("button", { name: "发布", exact: true })).toBeEnabled(); // only a hint
});
