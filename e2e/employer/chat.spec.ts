import { expect, test } from "@playwright/test";
import {
  jobCard,
  lastAssistant,
  publishFromPreview,
  sayInChat,
  searchJobList,
  signUpEmployer,
  uniqueCjkTitle,
} from "./helpers";

// /employer/post opens on the chat: one question at a time, quick replies as buttons, a live card.

test("a full conversation, from a short message to a published job", async ({ page }, testInfo) => {
  await signUpEmployer(page, testInfo);
  const title = uniqueCjkTitle("洗碗工", testInfo);
  await page.goto("/employer/post");
  await expect(page.getByRole("heading", { name: "和发帖助手一起写招聘" })).toBeVisible();
  const log = page.getByRole("log", { name: "和发帖助手的对话" });
  await expect(log).toHaveAttribute("aria-live", "polite");
  await expect(lastAssistant(page)).toContainText("用你自己的话");

  const card = page.getByRole("region", { name: /职位卡/ });
  await sayInChat(page, `招${title}`);
  await expect(lastAssistant(page)).toContainText("时薪多少");
  await expect(card).toContainText(title);
  await expect(card).toContainText(/已填 \d+ \/ \d+ 项/);

  await sayInChat(page, "25");
  await expect(lastAssistant(page)).toContainText("每周大概多少小时");
  await page.getByRole("button", { name: "20", exact: true }).click();
  await expect(lastAssistant(page)).toContainText("在哪个区");

  // Changing an earlier answer, then carrying on.
  await sayInChat(page, "改一下时薪");
  await expect(lastAssistant(page)).toContainText("时薪改成多少");
  await sayInChat(page, "26-28");
  await expect(card).toContainText("$26–28/小时");
  await expect(lastAssistant(page)).toContainText("在哪个区");

  await page.getByRole("button", { name: "Northcote", exact: true }).click();
  await expect(lastAssistant(page)).toContainText("是全职、兼职还是临时工");
  await expect(page.getByRole("button", { name: "都可以", exact: true })).toBeVisible();
  await sayInChat(page, "都可以");
  await expect(lastAssistant(page)).toContainText("好，接受全职 / 兼职 / 临时工");
  await expect(lastAssistant(page)).not.toContainText("是全职、兼职还是临时工");
  await expect(card).toContainText("全职 / 兼职 / 临时工");
  await page.getByRole("button", { name: "学签", exact: true }).click();
  await expect(lastAssistant(page)).toContainText("已加上：学签");
  await page.getByRole("button", { name: "就这些" }).click();
  await page.getByRole("button", { name: "包餐", exact: true }).click();
  // Contact details stay private unless the employer makes them public.
  await expect(lastAssistant(page)).toContainText("都齐了");
  await expect(lastAssistant(page)).toContainText("联系方式不公开");
  // The progress line opens into the list; an item there takes the chat back to its question.
  await card.getByRole("button", { name: "查看各项" }).click();
  await expect(card).toContainText("不公开 · 聊天交换");
  await card.getByRole("button", { name: /^地区/ }).click();
  await expect(lastAssistant(page)).toContainText("改到哪个区");
  await page.getByRole("button", { name: "Northcote", exact: true }).click();
  await expect(lastAssistant(page)).toContainText("都齐了");
  await page.getByRole("button", { name: "公开联系方式", exact: true }).click();
  await expect(lastAssistant(page)).toContainText("求职者怎么联系你");
  await sayInChat(page, "demo_e2e_chat");

  await expect(lastAssistant(page)).toContainText("都齐了");
  await expect(lastAssistant(page)).toContainText("联系方式公开");
  await expect(card).toContainText("可以预览");
  await page.getByRole("button", { name: "预览并发布" }).click();

  await expect(page.getByText(/^预览：/)).toBeFocused();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.getByRole("main")).toContainText("全职 / 兼职 / 临时工");
  await publishFromPreview(page);
  await searchJobList(page, title);
  await expect(jobCard(page, title)).toBeVisible();
  await expect(jobCard(page, title)).toContainText("全职 / 兼职 / 临时工");
});

test("compliance questions arrive in the chat and the employer's fixes reach the job", async ({ page }, testInfo) => {
  await signUpEmployer(page, testInfo);
  const title = uniqueCjkTitle("店员", testInfo);
  await page.goto("/employer/post");
  await sayInChat(
    page,
    `奶茶店招兼职${title}，市中心 Queen St，时薪 18，入职交押金200，限华人。学签OK。微信 cbdtea_demo`,
  );

  await expect(lastAssistant(page)).toContainText("时薪 $18 低于新西兰成人最低工资 $23.95");
  await expect(lastAssistant(page)).toContainText("时薪改成多少");
  await expect(page.getByRole("region", { name: /职位卡/ })).toContainText("3 个问题要处理");
  await sayInChat(page, "24");

  await expect(lastAssistant(page)).toContainText("含有「押金」");
  await page.getByRole("button", { name: "删掉这句" }).click();
  await expect(lastAssistant(page)).toContainText("含有「限华人」");
  await page.getByRole("button", { name: "改成「需会普通话」" }).click();
  await expect(lastAssistant(page)).toContainText("加上了普通话");

  await page.getByRole("button", { name: "不固定" }).click();
  await page.getByRole("button", { name: "都不包" }).click();
  await expect(lastAssistant(page)).toContainText("都齐了");
  await page.getByRole("button", { name: "预览并发布" }).click();

  const preview = page.getByRole("main");
  await expect(preview).toContainText("需会普通话");
  await expect(preview).not.toContainText("押金200");
  await expect(preview).not.toContainText("限华人");
  await expect(preview).toContainText("$24/小时");
  await publishFromPreview(page);
  await searchJobList(page, title);
  await expect(jobCard(page, title)).toBeVisible();
});
