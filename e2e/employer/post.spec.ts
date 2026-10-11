import { expect, test } from "@playwright/test";
import { findingsPanel, jobCard, publishFromPreview, searchHome, uniqueTitle } from "./helpers";

test("paste → findings hold publishing → fix → publish → the job is on the list", async ({ page }, testInfo) => {
  const title = uniqueTitle("奶茶店店员", testInfo);

  await page.goto("/employer/post");
  await page.getByLabel(/把微信群里的招聘消息粘贴进来/).fill("奶茶店招兼职店员，市中心 Queen St，时薪 20，入职交押金200，限华人。学签OK。微信 cbdtea_demo");
  await page.getByRole("button", { name: "整理成职位" }).click();

  // The parser filled the form; the checks hold the preview.
  await expect(page.getByLabel("职位名称（中文）")).toHaveValue("店员");
  const panel = findingsPanel(page);
  await expect(panel).toContainText("时薪 $20 低于新西兰最低工资 $23.95");
  await expect(panel).toContainText("含有「押金」");
  await expect(panel).toContainText("请改写：含有「限华人」");
  await expect(page.getByText("3 个问题要处理").filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "预览", exact: true })).toBeDisabled();

  // Fix pay and wording, then the preview opens.
  await page.getByRole("group", { name: /时薪/ }).getByRole("spinbutton", { name: "最低", exact: true }).fill("24.5");
  await page.getByLabel("中文描述").fill("市中心奶茶店招兼职店员，制作饮品和收银，需会普通话。学签可做。");
  await page.getByLabel("职位名称（中文）").fill(title);
  await expect(panel).toContainText("没有发现问题，可以预览发布。");
  await page.getByRole("button", { name: "预览", exact: true }).click();

  const id = await publishFromPreview(page);
  expect(id).toMatch(/^j\d+$/);

  await searchHome(page, title);
  await expect(page.getByText("找到 1 个职位").filter({ visible: true })).toBeVisible();
  await jobCard(page, title).click();
  await expect(page).toHaveURL(`/jobs/${id}`);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.getByText("$24.50/小时").first()).toBeVisible();
});

test("the checks sit beside the form on a wide screen and above it on a phone", async ({ page }, testInfo) => {
  await page.goto("/employer/post");
  await page.getByRole("button", { name: "不用粘贴，直接填表" }).click();
  const panel = await findingsPanel(page).boundingBox();
  const form = await page.getByLabel("职位名称（中文）").boundingBox();
  if (testInfo.project.name === "desktop") {
    expect(panel!.x).toBeGreaterThan(form!.x + form!.width);
  } else {
    expect(panel!.y + panel!.height).toBeLessThan(form!.y);
  }
});
