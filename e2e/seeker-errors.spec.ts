// When a job seeker's Server Function calls get no answer (no network, the server restarting): an action says so
// where it was pressed and keeps what was typed, instead of giving way to the error page (#251). The tests cut the
// page's Server Function calls (POSTs to its own path) for one press; the page and its scripts still load.
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
