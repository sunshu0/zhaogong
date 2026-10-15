import { expect, test } from "@playwright/test";
import { publishJob, signUpEmployer, uniqueTitle } from "./employer/helpers";

test("candidate page: the job it is about on top, 发起聊天 then 回到聊天, the five facts first", async ({
  page,
}, testInfo) => {
  await signUpEmployer(page, testInfo);
  const title = uniqueTitle("前厅服务员", testInfo);
  const id = await publishJob(page, title);

  await page.goto(`/candidates/candidate-lin?job=${id}`);
  await expect(page.getByRole("heading", { name: "林晓", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: title })).toHaveAttribute("href", `/jobs/${id}`);
  await expect(page.getByText("$25–27/小时").filter({ visible: true })).toBeVisible();
  const facts = page.getByRole("definition").filter({ visible: true });
  await expect(page.getByRole("term").filter({ visible: true }).first()).toHaveText("可上班时间");
  await expect(page.getByRole("term").filter({ visible: true }).nth(4)).toHaveText("经验");
  await expect(facts.first()).not.toHaveText("待补充");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.getByRole("button", { name: "发起聊天" }).click();
  await expect(page).toHaveURL(/\/messages\?conversation=recommend%3Acandidate-lin%3A/);
  await page.goto(`/candidates/candidate-lin?job=${id}`);
  await page.getByRole("link", { name: "回到聊天", exact: true }).click();
  await expect(page).toHaveURL(/\/messages\?conversation=recommend%3Acandidate-lin%3A/);
});

test("a job that is not yours shows no job on top", async ({ page }, testInfo) => {
  await signUpEmployer(page, testInfo);
  await page.goto("/candidates/candidate-lin?job=j1");
  await expect(page.getByRole("heading", { name: "林晓", exact: true })).toBeVisible();
  await expect(page.getByText("应聘职位")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "回到聊天", exact: true })).toBeVisible();
});
