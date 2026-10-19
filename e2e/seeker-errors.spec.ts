// When a job seeker's Server Function calls get no answer (no network, the server restarting): an action says so
// where it was pressed and keeps what was typed, instead of giving way to the error page (#251), and 退出登录 does
// not only look done (#254). The tests cut the page's Server Function calls (POSTs to its own path) for one press;
// the page and its scripts still load.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { expectProfileSaved, freshEmail, signIn } from "./helpers";

test.use({ reducedMotion: "reduce" });

/** Cuts the Server Function calls made from `path` while `cut.on` is true. */
async function cutCalls(page: Page, path: string) {
  const cut = { on: false };
  await page.route(
    (url) => url.pathname === path,
    (route) => (cut.on && route.request().method() === "POST" ? route.abort("internetdisconnected") : route.fallback()),
  );
  return cut;
}

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(violations).toEqual([]);
}

test("the CV's share link: no answer is said in the share card, the CV stays (#251)", async ({ page }) => {
  await signIn(page, "/profile", freshEmail("demo.errors.resume")); // starts with 林晓's page, so the CV has a name
  await page.getByLabel("交换用邮箱").fill("errors.resume@example.com");
  await expectProfileSaved(page);
  await page.goto("/profile/resume");
  const card = page.locator("#resume-share");
  const make = card.getByRole("button", { name: "生成分享链接" });
  await expect(make).toBeVisible();

  const cut = await cutCalls(page, "/profile/resume");
  cut.on = true;
  await make.click();
  await expect(card.getByRole("alert")).toHaveText("网络有问题，分享链接没有改成，请稍后再试。");
  await expect(page.getByRole("article", { name: "中英文简历" }).filter({ visible: true })).toBeVisible();
  await expectNoViolations(page);

  cut.on = false;
  await make.click();
  await expect(card.getByRole("link", { name: /\/resume\// })).toBeVisible();
  await expect(card.getByRole("alert")).toHaveCount(0);

  cut.on = true;
  await card.getByRole("button", { name: "关闭链接" }).click();
  await expect(card.getByRole("alert")).toHaveText("网络有问题，分享链接没有改成，请稍后再试。");
  await expect(card.getByRole("link", { name: /\/resume\// })).toBeVisible();
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("renaming an alert with no answer keeps the form and the typed name (#251)", async ({ page }) => {
  await signIn(page, "/jobs?industry=cleaning&meals=1", freshEmail("errors.alerts"));
  await page.getByRole("button", { name: "保存为提醒" }).click();
  await page.getByRole("status").getByRole("link", { name: "管理提醒" }).click();
  await expect(page).toHaveURL("/me/alerts");
  const alert = page.getByRole("article", { name: "提醒：清洁、包餐" });
  await alert.getByRole("button", { name: "改名" }).click();
  const name = page.getByLabel("提醒名称");
  await name.fill("包餐清洁工");

  const cut = await cutCalls(page, "/me/alerts");
  cut.on = true;
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("网络有问题，没有改成，请重试。");
  await expect(name).toHaveValue("包餐清洁工");
  await expectNoViolations(page);

  cut.on = false;
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("article", { name: "提醒：包餐清洁工" })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("the language switch with no answer stays on the page and says so beside it (#251)", async ({ page }) => {
  await page.goto("/jobs");
  const footer = page.locator("footer");
  const cut = await cutCalls(page, "/jobs");
  cut.on = true;
  await footer.getByRole("button", { name: "English" }).click();
  await expect(footer.getByRole("alert")).toHaveText("网络有问题，没有切换，请稍后再试。");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expectNoViolations(page);

  cut.on = false;
  await footer.getByRole("button", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-NZ");
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("退出登录 with no answer stays signed in and says so, instead of only looking signed out (#254)", async ({
  page,
  context,
}) => {
  const email = freshEmail("errors.signout");
  await signIn(page, "/account", email);
  await page.goto("/account");
  const cut = await cutCalls(page, "/account");
  cut.on = true;
  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page.getByText("网络有问题，还没有退出登录，请再试一次。")).toBeVisible();
  await expect(page).toHaveURL("/account");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("zhaogong:session") ?? "null")?.email)).toBe(email);
  expect((await context.cookies()).some((c) => c.name === "zg_session")).toBe(true);

  cut.on = false;
  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page).toHaveURL("/jobs");
  await expect.poll(async () => (await context.cookies()).some((c) => c.name === "zg_session")).toBe(false);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("loads that get no answer say so with 重试 instead of a greyed 申请 or a share card loading for good (#250)", async ({
  page,
}) => {
  await signIn(page, "/jobs/j3", freshEmail("demo.errors.loads"));

  // The job page: whether this account applied got no answer, so 申请 asks again.
  let cut = await cutCalls(page, "/jobs/j3");
  cut.on = true;
  await page.goto("/jobs/j3");
  const again = page.getByRole("button", { name: "重试后申请" });
  await expect(again).toBeVisible();
  await expectNoViolations(page);
  cut.on = false;
  await again.click();
  await expect(page.getByRole("button", { name: "申请", exact: true })).toBeEnabled();
  await page.unrouteAll({ behavior: "ignoreErrors" });

  // The CV's share card.
  cut = await cutCalls(page, "/profile/resume");
  cut.on = true;
  await page.goto("/profile/resume");
  const card = page.locator("#resume-share");
  const failed = card.getByRole("alert").filter({ hasText: "分享状态没取到" });
  await expect(failed).toBeVisible();
  cut.on = false;
  await failed.getByRole("button", { name: "重试" }).click();
  await expect(failed).toHaveCount(0);
  await expect(card.getByRole("button", { name: "生成分享链接" })).toBeVisible();
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("loads with no answer are not shown as nothing: 通知 and 总览 say what is missing, with 重试 (#252)", async ({
  page,
}) => {
  await signIn(page, "/workspace", freshEmail("errors.empty"));

  let cut = await cutCalls(page, "/notifications");
  cut.on = true;
  await page.goto("/notifications");
  const alerts = page.getByRole("alert").filter({ hasText: "职位提醒找到的新职位没取到" });
  await expect(alerts).toBeVisible();
  await expectNoViolations(page);
  cut.on = false;
  await alerts.getByRole("button", { name: "重试" }).click();
  await expect(alerts).toHaveCount(0);
  await page.unrouteAll({ behavior: "ignoreErrors" });

  cut = await cutCalls(page, "/workspace");
  cut.on = true;
  await page.goto("/workspace");
  const interviews = page.getByRole("alert").filter({ hasText: "面试待办没取到" });
  await expect(interviews).toBeVisible();
  await expect(page.getByText("都处理完了")).toHaveCount(0);
  cut.on = false;
  await interviews.getByRole("button", { name: "重试" }).click();
  await expect(interviews).toHaveCount(0);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});
