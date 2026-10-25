import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { waitForTitle } from "./helpers/title";

// S2 (#390, ADR 0041): 防骗指南 with the minimum wages read from the country's settings, and 我的举报: this device's
// job reports, 处理中 while the server has them open for this browser, else 已结束.
test.use({ reducedMotion: "reduce" });

const axe = async (page: import("@playwright/test").Page) => {
  await waitForTitle(page);
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(violations).toEqual([]);
};

test("防骗指南 names the common scams, the minimum wages from the settings, and only asks to report jobs", async ({
  page,
  context,
  baseURL,
}) => {
  await page.goto("/jobs");
  await page
    .locator("footer")
    .getByRole("navigation", { name: "关于和法律信息" })
    .getByRole("link", { name: "防骗指南" })
    .click();
  await expect(page).toHaveURL("/safety");
  const guide = page.getByRole("article", { name: "防骗指南" });
  for (const heading of [
    "先交钱才给工作",
    "花钱买签证或担保",
    "刷单、返利、垫付",
    "要护照原件、银行卡密码或验证码",
    "工资低于最低时薪",
  ])
    await expect(guide.getByRole("heading", { name: heading })).toBeVisible();
  await expect(guide).toContainText("成人最低时薪目前是每小时 $23.95");
  await expect(guide).toContainText("每小时 $19.16");
  await expect(guide).toContainText("0800 20 90 20");
  await expect(guide.getByRole("link", { name: /Immigration Advisers Authority/ })).toHaveAttribute(
    "href",
    "https://www.iaa.govt.nz/for-migrants/who-can-give-advice/",
  );
  await expect(guide).not.toContainText("举报聊天");
  await expect(guide).toContainText("不是法律意见");
  await axe(page);

  await context.addCookies([{ name: "zg_lang", value: "en", url: baseURL! }]);
  await page.reload();
  const english = page.getByRole("article", { name: "Staying safe from job scams" });
  await expect(english).toContainText("currently $23.95 an hour");
  await expect(english).toContainText("$19.16 an hour");
});

test("我的举报 lists this device's job report as 处理中, and as 已结束 once the server no longer knows it is ours", async ({
  page,
  context,
}) => {
  await page.goto("/me/reports");
  await expect(page.getByRole("heading", { level: 1, name: "我的举报" })).toBeVisible();
  await expect(page.getByText("这台设备还没有举报过职位。")).toBeVisible();

  await page.goto("/jobs/j5");
  await page.getByRole("button", { name: "举报这个职位" }).click();
  await page.getByRole("group", { name: "举报这个职位" }).getByLabel("虚假职位").check();
  await page.getByRole("button", { name: "提交举报" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText("谢谢你的举报");

  await page.goto("/me/reports");
  const jobs = page.getByRole("region", { name: "职位举报" });
  await expect(jobs.getByRole("listitem")).toHaveCount(1);
  await expect(jobs.getByRole("listitem")).toContainText("虚假职位 · 处理中");
  await expect(page.getByText("换设备、清掉浏览器数据或访客 cookie 以后")).toBeVisible();
  // The page's own link (the footer has one too).
  await expect(page.getByRole("main").getByRole("link", { name: /防骗指南/ })).toHaveAttribute("href", "/safety");
  await axe(page);

  // A new visitor id: the report is still on this device, but the server no longer finds it open for this browser.
  await context.clearCookies();
  await page.reload();
  await expect(jobs.getByRole("listitem")).toContainText("虚假职位 · 已结束（已处理，或审核员看过觉得没问题）");
});
