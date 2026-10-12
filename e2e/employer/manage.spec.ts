import { expect, test } from "@playwright/test";
import { jobCard, publishJob, searchJobList, uniqueTitle } from "./helpers";

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

  await searchJobList(page, title);
  await expect(page.getByText("暂时没有符合条件的职位").filter({ visible: true })).toBeVisible();

  await page.goto("/employer/jobs");
  await card.getByRole("button", { name: "重新开放" }).click();
  await expect(page.getByRole("status")).toHaveText(`${title}：已重新开放 30 天`);
  await expect(card.getByRole("button", { name: "今天已刷新过" })).toBeDisabled();

  await searchJobList(page, title);
  await expect(jobCard(page, title)).toBeVisible();
});

test("ending a job asks how many were hired; the count shows and can be corrected", async ({ page }, testInfo) => {
  const title = uniqueTitle("前厅服务员", testInfo);
  await publishJob(page, title);
  await page.goto("/employer/jobs");
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: title }) });

  await card.getByRole("button", { name: "结束招聘" }).click();
  const question = card.getByRole("group", { name: /通过找工招到人了吗/ });
  await expect(question).toContainText("（可不填）");
  await expect(question.getByLabel("招到的人数")).toBeDisabled();
  await question.getByLabel("招到了").check();
  await question.getByLabel("招到的人数").selectOption("2");
  await question.getByRole("button", { name: "确定结束招聘" }).click();
  await expect(page.getByRole("status")).toHaveText(`${title}：已结束招聘，已招到 2 人`);
  await expect(card).toContainText("已结束");
  await expect(card).toContainText("已招到 2 人");

  await card.getByRole("button", { name: "更正招到人数" }).click();
  const correction = card.getByRole("group", { name: /通过找工招到人了吗/ });
  await expect(correction.getByLabel("招到的人数")).toHaveValue("2");
  await correction.getByLabel("没有 / 不确定").check();
  await correction.getByRole("button", { name: "保存" }).click();
  await expect(page.getByRole("status")).toHaveText(`${title}：已记录，没有通过找工招到人`);
  await expect(card).toContainText("没有通过找工招到人");
});
