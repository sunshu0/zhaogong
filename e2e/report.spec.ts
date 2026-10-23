import { expect, test } from "@playwright/test";

test("report a job: reasons, a note, thank-you, and remembered on reload", async ({ page }) => {
  await page.goto("/jobs/j7");
  await page.getByRole("button", { name: "举报这个职位" }).click();

  const form = page.getByRole("group", { name: "举报这个职位" });
  await page.getByRole("button", { name: "提交举报" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("请选择举报原因");

  await form.getByLabel("其他").check();
  await page.getByRole("button", { name: "提交举报" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("选择“其他”时，请简单写一下原因");

  await form.getByLabel("收押金 / 介绍费").check();
  await expect(page.getByText("0 / 500")).toBeVisible();
  await page.getByLabel("补充说明（选填）").fill("电话里要求先交 200 元押金");
  // #303: the note counts against its limit, as the application's note does.
  await expect(page.getByText("15 / 500")).toBeVisible();
  await page.getByRole("button", { name: "提交举报" }).click();

  await expect(page.getByRole("main").getByRole("status")).toContainText("谢谢你的举报");
  await page.reload();
  await expect(page.getByText("你已经举报过这个职位，我们会尽快核查。").filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "举报这个职位" })).toHaveCount(0);
});

// Security review C (ADR 0034): the server keeps one open report per person and job, not only this browser's memory.
test("a second report on the same job from the same browser is refused by the server, with its memory cleared", async ({
  page,
}) => {
  const report = async () => {
    await page.getByRole("button", { name: "举报这个职位" }).click();
    await page.getByRole("group", { name: "举报这个职位" }).getByLabel("虚假职位").check();
    await page.getByRole("button", { name: "提交举报" }).click();
  };
  await page.goto("/jobs/j8");
  await report();
  await expect(page.getByRole("main").getByRole("status")).toContainText("谢谢你的举报");
  // The page's own note of it gone (another device of the same visitor would not have it either).
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await report();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("你已经举报过这个职位，我们会尽快核查。");
});
