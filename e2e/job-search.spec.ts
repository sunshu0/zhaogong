// bugs-1 (user feedback 10-30, brief-A-bugs-1.md): 最低时薪 counts a job's lowest pay, and the search finds a business
// by its name and a job by its title and area together. On the demo jobs: j1 is 川味小馆's 前厅服务员 at $25–27 in Mt
// Eden, j2 its 厨房帮工 there.
import { expect, test, type Page } from "@playwright/test";

const job = (page: Page, id: string) => page.getByRole("main").locator(`a[href="/jobs/${id}"]`);

test("最低时薪 $27 起 leaves out a $25–27 job; $25 起 still has it", async ({ page }) => {
  await page.goto("/jobs?minPay=27");
  await expect(page.getByText(/找到 \d+ 个职位/).filter({ visible: true })).toBeVisible();
  await expect(job(page, "j1")).toHaveCount(0);
  await page.goto("/jobs?minPay=25");
  await expect(job(page, "j1").first()).toBeVisible();
});

test("the search finds a business by its name, and a job by its title and area together", async ({ page }) => {
  await page.goto("/jobs");
  const search = page.getByRole("searchbox", { name: "搜索职位" });
  await search.fill("川味小馆");
  await search.press("Enter");
  await expect(page).toHaveURL(/q=%E5%B7%9D%E5%91%B3%E5%B0%8F%E9%A6%86/);
  await expect(job(page, "j1").first()).toBeVisible();
  await expect(job(page, "j2").first()).toBeVisible();

  // Two words, in two fields (the title and the area), with a Chinese full-width space between them.
  await page.goto(`/jobs?q=${encodeURIComponent("厨房帮工　Mt Eden")}`);
  await expect(job(page, "j2").first()).toBeVisible();
  await expect(job(page, "j1")).toHaveCount(0);
  // Every word must be found: one that is nowhere leaves nothing.
  await page.goto(`/jobs?q=${encodeURIComponent("厨房帮工 叉车")}`);
  await expect(page.getByText("暂时没有符合条件的职位").filter({ visible: true })).toBeVisible();
});
