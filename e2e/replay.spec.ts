import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { fillSignInCode } from "./helpers";

// A18: the landing page's order, and the replay of a real AI chat post (startChat / nextTurn, not a script).

const features = (page: Page) => page.getByRole("region", { name: "功能展示" });
const bubbles = (page: Page) => features(page).locator("[data-replay-log] [data-bubble]");
const transcript = (page: Page) => features(page).locator("ol.sr-only li");

test("the landing page runs hero → stats → features → featured jobs → employers", async ({ page }) => {
  await page.goto("/");
  const order = [
    page.getByRole("region", { name: /^奥克兰的中文工作/ }),
    page.getByRole("region", { name: "平台数据" }),
    features(page),
    page.getByRole("region", { name: "精选工作" }),
    page.getByRole("region", { name: "招人？一分钟发布招聘" }),
  ];
  const ys: number[] = [];
  for (const region of order) ys.push((await region.boundingBox())!.y);
  expect([...ys].sort((a, b) => a - b)).toEqual(ys);
});

test("screen readers get the whole conversation, with the three problems and the fix", async ({ page }) => {
  await page.goto("/");
  await expect(transcript(page)).toHaveCount(13);
  await expect(transcript(page).first()).toContainText("助手：你好！");
  await expect(transcript(page).nth(1)).toContainText("雇主：奶茶店招兼职店员");
  const all = (await transcript(page).allTextContents()).join("\n");
  for (const text of ["低于新西兰最低工资", "押金", "限华人", "雇主：24", "都齐了"]) expect(all).toContain(text);
  await expect(features(page).locator("[data-replay-log]")).toHaveAttribute("aria-hidden", "true");
});

test.describe("at 1280 × 800", () => {
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });

  test("before the replay starts, the window already shows the first round (no blank box)", async ({ page }) => {
    await page.goto("/");
    // Not scrolled into view yet: the greeting, the employer's post and the assistant's reply are there.
    await expect(bubbles(page)).toHaveCount(3);
    await expect(bubbles(page).nth(1)).toContainText("奶茶店招兼职店员");
    for (let i = 0; i < 3; i += 1) await expect(bubbles(page).nth(i)).toBeVisible();
  });

  test("the replay plays message by message when it comes into view, and can play again", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/");
    await features(page).locator("[data-replay-log]").scrollIntoViewIfNeeded();
    // Visible ones: before hydration the HTML holds all 13 (for no JavaScript), all but the first round hidden.
    const shown = bubbles(page).filter({ visible: true });
    await expect.poll(() => shown.count()).toBeGreaterThan(0);
    expect(await shown.count()).toBeLessThan(13); // still playing
    await expect(bubbles(page)).toHaveCount(13, { timeout: 40_000 });
    await expect(bubbles(page).last()).toContainText("都齐了");

    await features(page).getByRole("button", { name: "重新播放" }).click();
    await expect.poll(() => bubbles(page).count()).toBeLessThan(13);
    await expect(bubbles(page)).toHaveCount(13, { timeout: 40_000 });
  });
});

test("with reduced motion the whole conversation shows at once", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(bubbles(page)).toHaveCount(13);
  await expect(bubbles(page).first()).toBeVisible();
  await expect(features(page).getByRole("button", { name: "重新播放" })).toHaveCount(0);
});

const email = (testInfo: TestInfo) => `replay.${testInfo.project.name}.${Date.now()}@example.com`;

test("我要招人 goes straight to posting once the account is an employer", async ({ page }, testInfo) => {
  await page.goto("/login?role=employer&next=%2F");
  await page.getByLabel("邮箱", { exact: true }).fill(email(testInfo));
  await page.getByRole("button", { name: "获取验证码" }).click();
  await fillSignInCode(page);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.getByRole("radio", { name: /新建企业/ }).check();
  await page.getByLabel("店名", { exact: true }).fill(`回放测试店${Date.now() % 1e6}`);
  await page.getByRole("combobox", { name: /^地区/ }).selectOption({ label: "市中心" });
  await page.getByRole("button", { name: "开通并开始发布招聘" }).click();
  await expect(page).toHaveURL("/");

  // The header's 发布招聘 (phones post from the bottom bar instead) and the employer band both go to posting.
  if (testInfo.project.name === "desktop") {
    await expect(page.getByRole("banner").getByRole("link", { name: "发布招聘" })).toHaveAttribute(
      "href",
      "/employer/post",
    );
  }
  await expect(
    page.getByRole("region", { name: "招人？一分钟发布招聘" }).getByRole("link", { name: "注册雇主 →" }),
  ).toHaveAttribute("href", "/employer/post");
});
