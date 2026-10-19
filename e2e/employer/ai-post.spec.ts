import { expect, test, type Page } from "@playwright/test";
import {
  jobCard,
  lastAssistant,
  publishFromPreview,
  sayInChat,
  searchJobList,
  signUpEmployer,
  uniqueCjkTitle,
} from "./helpers";

// AI 发帖 with a model (#102). The shared dev server has no key, so these tests switch their own browser to the
// fixed-answer fake model with a cookie (outside production only); everything around the call runs as with Claude.

async function useFakeModel(page: Page, baseURL: string | undefined) {
  await page.context().addCookies([{ name: "zg_ai_fake", value: "1", url: baseURL! }]);
}

test("the model fills the job from the conversation, the rules still check it, and 预览并发布 publishes", async ({
  page,
  baseURL,
}, testInfo) => {
  await useFakeModel(page, baseURL);
  await signUpEmployer(page, testInfo);
  const title = uniqueCjkTitle("服务员", testInfo);
  await page.goto("/employer/post");
  await expect(page.getByRole("heading", { name: "和发帖助手一起写招聘" })).toBeVisible();
  await expect(page.getByText("开发环境：脚本助手，不是 AI。")).toHaveCount(0);
  // #342: before anything is sent, where it goes, the privacy page's §5, and the way out.
  await expect(page.getByText("你发给助手的内容会送到美国的 Anthropic 处理。")).toBeVisible();
  await expect(page.getByRole("link", { name: "隐私说明第 5 节" })).toHaveAttribute("href", "/privacy#share");

  const card = page.getByRole("region", { name: /职位卡/ });
  await sayInChat(page, `Mt Eden 川菜馆招${title}，时薪 18，兼职，学签可做，需会普通话`);
  // The model wrote the pay; the minimum-wage rule speaks in the same answer.
  await expect(lastAssistant(page)).toContainText("低于新西兰成人最低工资");
  await expect(card).toContainText(title);
  await sayInChat(page, "时薪 26");
  await expect(lastAssistant(page)).toContainText("英文怎么说");
  await sayInChat(page, "Waiter");
  await expect(lastAssistant(page)).toContainText("联系方式要公开吗");
  await page.getByRole("button", { name: "不公开，聊天交换" }).click();
  await expect(lastAssistant(page)).toContainText("都齐了");
  await page.getByRole("button", { name: "预览并发布" }).click();

  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.getByRole("main")).toContainText("$26/小时");
  await publishFromPreview(page);
  await searchJobList(page, title);
  await expect(jobCard(page, title)).toBeVisible();
});

test("when the model fails, the chat says the assistant is unavailable and offers the form", async ({
  page,
  baseURL,
}, testInfo) => {
  await useFakeModel(page, baseURL);
  await signUpEmployer(page, testInfo);
  await page.goto("/employer/post");
  await sayInChat(page, "招服务员【测试：出错】");
  await expect(lastAssistant(page)).toContainText("AI 发帖助手暂时不可用");
  await page.getByRole("button", { name: "改用直接填表" }).click();
  await expect(page.getByLabel("职位名称（中文）")).toBeVisible();
});

test("outside production without a key, the page says the script is answering, not an AI", async ({
  page,
}, testInfo) => {
  await signUpEmployer(page, testInfo);
  await page.goto("/employer/post");
  await expect(page.getByText("开发环境：脚本助手，不是 AI。")).toBeVisible();
  // The script sends nothing anywhere, so nothing is said about Anthropic (#342).
  await expect(page.getByText(/Anthropic/)).toHaveCount(0);
});

test("the line about Anthropic links to the privacy page's §5 and offers the form instead (#342)", async ({
  page,
  baseURL,
}, testInfo) => {
  await useFakeModel(page, baseURL);
  await signUpEmployer(page, testInfo);
  await page.goto("/employer/post");
  await page.getByRole("button", { name: "不想发送就直接填表" }).click();
  // With nothing written yet, 直接填表 opens on its paste step, which sends nothing either.
  await expect(page.getByRole("button", { name: "直接填表", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { level: 1, name: "一分钟发布招聘" })).toBeVisible();
  await page.goto("/employer/post");
  await page.getByRole("link", { name: "隐私说明第 5 节" }).click();
  await expect(page).toHaveURL(/\/privacy#share$/);
  await expect(page.getByRole("heading", { level: 2, name: /^5\./ })).toBeVisible();
});
