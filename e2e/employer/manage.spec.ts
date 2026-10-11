import { expect, test } from "@playwright/test";
import { jobCard, publishJob, searchHome, uniqueTitle } from "./helpers";

test("manage → end a job → it leaves the list; reopen → it is back", async ({ page }, testInfo) => {
  const title = uniqueTitle("前厅服务员", testInfo);
  await publishJob(page, title);

  await page.goto("/employer/jobs");
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: title }) });
  await expect(card).toContainText("招聘中");
  await expect(card).toContainText("还有 30 天到期");

  await card.getByRole("button", { name: "结束招聘" }).click();
  await card.getByRole("button", { name: "确定结束招聘" }).click();
  await expect(page.getByRole("status")).toHaveText(`${title}：已结束招聘`);
  await expect(card).toContainText("已结束");

  await searchHome(page, title);
  await expect(page.getByText("暂时没有符合条件的职位").filter({ visible: true })).toBeVisible();

  await page.goto("/employer/jobs");
  await card.getByRole("button", { name: "重新开放" }).click();
  await expect(page.getByRole("status")).toHaveText(`${title}：已重新开放 30 天`);
  await expect(card.getByRole("button", { name: "今天已刷新过" })).toBeDisabled();

  await searchHome(page, title);
  await expect(jobCard(page, title)).toBeVisible();
});
