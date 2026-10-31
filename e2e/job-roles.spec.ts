import { expect, test } from "@playwright/test";
import { expectProfileSaved, freshEmail, signIn } from "./helpers";
import {
  CLEAN_MESSAGE,
  jobCard,
  lastAssistant,
  openTheForm,
  publishFromPreview,
  sayInChat,
  signUpEmployer,
  uniqueCjkTitle,
  uniqueTitle,
} from "./employer/helpers";

// 岗位类别 (#96): employers file a job under at most two categories (preselected from the title), job seekers tick
// the ones they want, and the job list filters by them.

test("直接填表: the title's 岗位类别 is ticked, at most two, and the list filters by the choice", async ({
  page,
}, testInfo) => {
  await signUpEmployer(page, testInfo);
  await openTheForm(page);
  await page.getByLabel(/把微信群里的招聘消息粘贴进来/).fill(CLEAN_MESSAGE);
  await page.getByRole("button", { name: "整理成职位" }).click();
  const title = uniqueTitle("接待员", testInfo);
  await page.getByLabel("职位名称（中文）").fill(title);

  const roles = page.getByRole("group", { name: "岗位类别" });
  await expect(roles.getByLabel("前厅服务")).toBeChecked();
  await expect(roles).toContainText("按职位名预选了前厅服务");
  // Only the categories of the job's industry are offered.
  await expect(roles.getByLabel("办公文员")).toHaveCount(0);
  await roles.getByLabel("收银").check();
  await expect(roles.getByLabel("后厨帮工")).toBeDisabled();
  await roles.getByLabel("前厅服务").uncheck();
  await expect(roles.getByLabel("后厨帮工")).toBeEnabled();

  await page.getByRole("button", { name: "预览", exact: true }).click();
  const id = await publishFromPreview(page);
  expect(id).toBeTruthy();

  const query = `q=${encodeURIComponent(title)}`;
  await page.goto(`/jobs?role=cashier&${query}`);
  await expect(page.getByRole("link", { name: "收银，去掉这个条件" })).toBeVisible();
  await expect(jobCard(page, title)).toBeVisible();
  await page.goto(`/jobs?role=front_of_house&${query}`);
  await expect(page.getByText("找到 0 个职位").filter({ visible: true })).toBeVisible();
  await expect(jobCard(page, title)).toHaveCount(0);
});

test("对话发布: the card shows the 岗位类别 preselected from the title; 预览 confirms or changes it", async ({
  page,
}, testInfo) => {
  await signUpEmployer(page, testInfo);
  const title = uniqueCjkTitle("传菜员", testInfo);
  await page.goto("/employer/post");
  await sayInChat(
    page,
    `Mt Eden 川菜馆招${title}，时薪 $25-27，每周 15-25 小时，兼职，包工作餐，学签可做，需会普通话。微信 demo_e2e_r`,
  );
  const card = page.getByRole("region", { name: /职位卡/ });
  await expect(card).toContainText("岗位类别：前厅服务（按职位名预选，预览时可以改）");
  await expect(lastAssistant(page)).toContainText("英文怎么说");
  await sayInChat(page, "Food runner");
  await expect(lastAssistant(page)).toContainText("都齐了");
  await page.getByRole("button", { name: "预览并发布" }).click();

  const roles = page.getByRole("group", { name: "岗位类别" });
  await expect(roles.getByLabel("前厅服务")).toBeChecked();
  await roles.getByLabel("前厅服务").uncheck();
  await roles.getByLabel("后厨帮工").check();
  await publishFromPreview(page);
  await page.goto(`/jobs?role=kitchen_hand&q=${encodeURIComponent(title)}`);
  await expect(jobCard(page, title)).toBeVisible();
});

test("求职者: 想做的岗位 is ticked by category and kept", async ({ page }) => {
  await signIn(page, "/profile", freshEmail("roles"));
  const roles = page.getByRole("group", { name: "想做的岗位" });
  await roles.getByLabel("前厅服务").check();
  await roles.getByLabel("咖啡奶茶").check();
  await expectProfileSaved(page);
  await page.reload();
  await expect(roles.getByLabel("前厅服务")).toBeChecked();
  await expect(roles.getByLabel("咖啡奶茶")).toBeChecked();
  await expect(roles.getByLabel("清洁")).not.toBeChecked();
});
