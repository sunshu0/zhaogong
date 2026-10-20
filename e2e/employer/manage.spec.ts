import { expect, test } from "@playwright/test";
import { jobCard, publishJob, searchJobList, signUpEmployer, uniqueTitle, cardMenuItem } from "./helpers";
import { chooseOption } from "../helpers";

test("manage → end a job → it leaves the list; renew → it is back (#69)", async ({ page }, testInfo) => {
  await signUpEmployer(page, testInfo);
  const title = uniqueTitle("前厅服务员", testInfo);
  await publishJob(page, title);

  await page.goto("/employer/jobs");
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: title }) });
  await expect(card).toContainText("招聘中");
  await expect(card).toContainText("30 天后截止");

  await expect(card.getByRole("link", { name: "查看", exact: true })).toHaveAttribute("href", /^\/jobs\/j\d+$/);
  await expect(card).toContainText("还没有人聊过");
  await (await cardMenuItem(card, "结束招聘")).click();
  await card.getByRole("button", { name: "确定结束招聘" }).click();
  await expect(page.getByRole("status")).toHaveText(`${title}：已结束招聘`);
  await expect(card).toContainText("已结束");

  await searchJobList(page, title);
  await expect(page.getByText("暂时没有符合条件的职位").filter({ visible: true })).toBeVisible();

  await page.goto("/employer/jobs");
  await expect(card).toContainText("还可以续期 14 天");
  await (await cardMenuItem(card, "续期")).click();
  await card.getByRole("button", { name: "确定续期" }).click();
  await expect(page.getByRole("status")).toContainText(`${title}：已续期 30 天，`);
  await expect(card).toContainText("招聘中");
  await expect(card).toContainText("已续期 1 次");
  await expect(await cardMenuItem(card, "今天已刷新过")).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Escape");

  await searchJobList(page, title);
  await expect(jobCard(page, title)).toBeVisible();
});

test("ending a job asks how many were hired; the count shows and can be corrected", async ({ page }, testInfo) => {
  await signUpEmployer(page, testInfo);
  const title = uniqueTitle("前厅服务员", testInfo);
  await publishJob(page, title);
  await page.goto("/employer/jobs");
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: title }) });

  await (await cardMenuItem(card, "结束招聘")).click();
  const question = card.getByRole("group", { name: /通过找工招到人了吗/ });
  await expect(question).toContainText("（可不填）");
  // How many shows once 招到了 is chosen (Round 19: a Select).
  await expect(question.getByRole("button", { name: /^招到的人数/ })).toHaveCount(0);
  await question.getByLabel("招到了").check();
  await chooseOption(page, question, "招到的人数", "2 人");
  await question.getByRole("button", { name: "确定结束招聘" }).click();
  await expect(page.getByRole("status")).toHaveText(`${title}：已结束招聘，已招到 2 人`);
  await expect(card).toContainText("已结束");
  await expect(card).toContainText("已招到 2 人");

  await (await cardMenuItem(card, "更正招到人数")).click();
  const correction = card.getByRole("group", { name: /通过找工招到人了吗/ });
  await expect(correction.getByRole("button", { name: /^招到的人数/ })).toContainText("2 人");
  await correction.getByLabel("没有 / 不确定").check();
  await correction.getByRole("button", { name: "保存" }).click();
  await expect(page.getByRole("status")).toHaveText(`${title}：已记录，没有通过找工招到人`);
  await expect(card).toContainText("没有通过找工招到人");
});

test("复制为新职位 starts a new job from a live one; both are listed (#190)", async ({ page }, testInfo) => {
  await signUpEmployer(page, testInfo);
  const title = uniqueTitle("前厅服务员", testInfo);
  await publishJob(page, title);

  await page.goto("/employer/jobs");
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: title }) });
  await (await cardMenuItem(card, "复制为新职位")).click();
  await expect(page.getByRole("heading", { name: "复制为新职位" })).toBeVisible();
  const copyTitle = uniqueTitle("收银员", testInfo);
  const name = page.getByLabel("职位名称（中文）");
  await expect(name).toHaveValue(title);
  // The same title as a live job of the shop: a hint to renew or edit that one instead (#196).
  const twin = page.getByText(`你已经有一条在招的「${title}」`);
  await expect(twin).toBeVisible();
  await name.fill(copyTitle);
  await expect(twin).toHaveCount(0);
  await page.getByRole("button", { name: "发布", exact: true }).click();
  await expect(page.getByRole("heading", { name: "已发布" })).toBeVisible();

  await page.goto("/employer/jobs");
  const copy = page.getByRole("article").filter({ has: page.getByRole("heading", { name: copyTitle }) });
  await expect(copy).toContainText("聊过的人 0");
  await expect(card).toBeVisible();
});
