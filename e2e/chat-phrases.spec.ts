import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { freshEmail, signIn } from "./helpers";
import { waitForTitle } from "./helpers/title";

// #372 常用语 above the chat's box, one press sends; #373 the job seeker's 开场白, put in the box by 立即沟通 and not
// sent. ADR 0035.
test.use({ reducedMotion: "reduce" });

async function expectNoViolations(page: Page) {
  await waitForTitle(page);
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(violations).toEqual([]);
}

async function startChat(page: Page, jobId: string) {
  await page.goto(`/jobs/${jobId}`);
  await page.getByRole("main").getByRole("button", { name: "立即沟通", exact: true }).click();
  await expect(page).toHaveURL(/\/messages\?conversation=employer%3A/);
}

test("立即沟通 puts the 开场白 in the box without sending it; a 常用语 is sent with one press", async ({ page }) => {
  await signIn(page, "/jobs", freshEmail("phrases.seeker"));
  await startChat(page, "j1");
  const box = page.getByLabel("输入消息");
  await expect(box).toHaveValue("您好，我对「前厅服务员」很感兴趣，想多了解一下，方便聊聊吗？");
  const log = page.getByRole("log", { name: "消息记录" });
  await expect(log).not.toContainText("您好，我对");

  const phrases = page.getByRole("list", { name: "常用语" });
  await expect(phrases.getByRole("button")).toHaveCount(5);
  await expectNoViolations(page);
  await phrases.getByRole("button", { name: "发送常用语：请问这个职位还在招吗？" }).click();
  await expect(log).toContainText("请问这个职位还在招吗？");
  // The 开场白 is still in the box, unsent; the chat now has a message, so 立即沟通 again leaves the box alone.
  await expect(box).toHaveValue(/^您好，我对「前厅服务员」/);
  await box.fill("");
  await startChat(page, "j1");
  await expect(box).toHaveValue("");
});

test("管理: changed, moved, deleted and added 常用语 and the chosen 开场白 stay after a reload; contact details are refused", async ({
  page,
}) => {
  await signIn(page, "/jobs", freshEmail("phrases.manage"));
  await startChat(page, "j1");
  await page.getByRole("button", { name: "管理常用语和开场白" }).click();
  const dialog = page.getByRole("dialog", { name: "常用语和开场白" });
  await dialog.getByLabel("常用语 1").fill("周末可以上班吗？");
  await dialog.getByRole("button", { name: "下移第 1 条" }).click();
  await expect(dialog.getByLabel("常用语 2")).toHaveValue("周末可以上班吗？");
  await expect(dialog.getByRole("button", { name: "下移第 2 条" })).toBeFocused();
  await dialog.getByRole("button", { name: "删除第 5 条" }).click();
  await dialog.getByRole("button", { name: "添加一条" }).click();
  await expect(dialog.getByLabel("常用语 5")).toBeFocused();
  await dialog.getByLabel("常用语 5").fill("加我微信 zhaogong88 详聊");
  await dialog.getByRole("radio", { name: /^模板 3：/ }).check();
  await dialog.getByRole("button", { name: "保存" }).click();
  await expect(dialog.getByRole("alert")).toContainText("第 5 条里有联系方式（zhaogong88）");
  await expectNoViolations(page);

  await dialog.getByLabel("常用语 5").fill("我有餐饮经验。");
  await dialog.getByRole("button", { name: "保存" }).click();
  await expect(dialog).toBeHidden();
  const phrases = page.getByRole("list", { name: "常用语" }).getByRole("button");
  await expect(phrases.nth(1)).toHaveAccessibleName("发送常用语：周末可以上班吗？");

  await page.reload();
  await expect(phrases).toHaveCount(5);
  await expect(phrases.nth(0)).toHaveAccessibleName("发送常用语：请问每周大概排几个班，每个班几个小时？");
  await expect(phrases.nth(1)).toHaveAccessibleName("发送常用语：周末可以上班吗？");
  await expect(phrases.nth(4)).toHaveAccessibleName("发送常用语：我有餐饮经验。");
  // The chosen 开场白 comes with the next new chat, with that job's name.
  await startChat(page, "j2");
  await expect(page.getByLabel("输入消息")).toHaveValue("您好，请问「厨房帮工」还在招人吗？我可以尽快开始上班。");
});
