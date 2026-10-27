import { expect, test, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { freshEmail, signIn } from "./helpers";
import { waitForTitle } from "./helpers/title";

// 操作手感第二件「小手感」(#405): 收藏 shows the moment it is pressed and goes back when the server does not keep
// it; on a phone 收藏 is in the job page's fixed bar; the small controls are 44 px to press; the chat folds its job
// bar while the keyboard is up, and (#415) its activity lines and 常用语 row.
test.use({ reducedMotion: "reduce" });

const PHONE = { width: 375, height: 667 };

const saveButton = (page: Page, title: string) =>
  page.getByRole("button", { name: `收藏：${title}`, exact: true }).filter({ visible: true });

/** The page's Server Function calls (POSTs to `path`): held until release(), or cut while `cut` is on. */
async function interceptCalls(page: Page, path: string) {
  let release = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  const calls = { hold: false, cut: false };
  await page.route(
    (url) => url.pathname === path,
    async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      if (calls.cut) return route.abort("internetdisconnected");
      if (calls.hold) await gate;
      return route.fallback();
    },
  );
  return {
    calls,
    release: () => {
      calls.hold = false;
      release();
    },
  };
}

async function expectTouchSized(control: Locator, what: string) {
  await expect(control).toBeVisible();
  const box = (await control.boundingBox())!;
  expect(box.height, `${what}: height`).toBeGreaterThanOrEqual(44);
  expect(box.width, `${what}: width`).toBeGreaterThanOrEqual(44);
}

test("收藏 shows at once, before the server answers, and goes back when there is no answer", async ({ page }) => {
  await signIn(page, "/jobs/j3", freshEmail("feel.save"));
  const save = saveButton(page, "点心师傅");
  await expect(save).toHaveAttribute("aria-pressed", "false");
  const server = await interceptCalls(page, "/jobs/j3");

  // Held: 已收藏 shows while the server has not answered yet.
  server.calls.hold = true;
  await save.click();
  await expect(save).toHaveAttribute("aria-pressed", "true");
  await expect(save).toHaveAttribute("aria-busy", "true");
  server.release();
  await expect(save).not.toHaveAttribute("aria-busy");
  await expect(save).toHaveAttribute("aria-pressed", "true");

  // No answer: it shows the change, then goes back as it was and says so.
  server.calls.cut = true;
  await save.click();
  await expect(save).not.toHaveAttribute("aria-busy");
  await expect(save).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("网络有问题，没有取消，请重试")).toBeVisible();
  server.calls.cut = false;
  await page.unrouteAll({ behavior: "ignoreErrors" });

  // The server kept the first press only.
  await page.reload();
  await expect(saveButton(page, "点心师傅")).toHaveAttribute("aria-pressed", "true");
});

test.describe("phone", () => {
  test.skip(({ isMobile }) => !isMobile, "the phone's layout");
  test.use({ viewport: PHONE });

  test("the job page's fixed bar has 收藏 beside 立即沟通; the header's is the desktop's", async ({
    page,
  }, testInfo) => {
    await page.goto("/jobs/j3");
    const bar = page.locator(".bottom-above-nav").filter({ hasText: "立即沟通" });
    await expect(bar.getByRole("button", { name: "收藏：点心师傅", exact: true })).toBeVisible();
    await expect(bar).toContainText("立即沟通");
    // The header's 收藏 is the desktop's: hidden here, so only the bar's is there to press.
    await expect(page.locator('button[aria-label="收藏：点心师傅"]')).toHaveCount(2);
    await expect(saveButton(page, "点心师傅")).toHaveCount(1);
    await expectTouchSized(saveButton(page, "点心师傅"), "收藏 in the bar");
    await page.screenshot({ path: testInfo.outputPath("job-bar.png") });
  });

  test("the small controls are 44 px to press", async ({ page }, testInfo) => {
    await page.goto("/jobs?industry=hospitality");
    await expectTouchSized(page.getByRole("link", { name: /^去掉条件：/ }).first(), "已选筛选");
    const sections = page.getByRole("navigation", { name: "外部职位分区" });
    await expect(sections.getByRole("link")).toHaveCount(2);
    for (const link of await sections.getByRole("link").all()) await expectTouchSized(link, "分类药丸");
    await expectTouchSized(
      page
        .getByRole("button", { name: /^收藏：/ })
        .filter({ visible: true })
        .first(),
      "列表的收藏",
    );
    await page.screenshot({ path: testInfo.outputPath("jobs.png") });

    await page.goto("/jobs/j3");
    for (const tab of await page.getByRole("tab").all()) await expectTouchSized(tab, "详情标签页");
    await expectTouchSized(page.getByRole("main").getByRole("link", { name: "职位列表", exact: true }), "返回列表");
  });

  test("with the keyboard up the chat folds its job bar, activity and 常用语, and brings them back when it goes down", async ({
    page,
  }, testInfo) => {
    await signIn(page, "/messages?conversation=north-tea", freshEmail("demo.feel-keys"));
    const thread = page.getByRole("region", { name: /北岸早茶酒家/ });
    const job = thread.getByRole("link", { name: /^聊的职位：/ });
    const activity = thread.getByLabel("沟通状态", { exact: true });
    const phrases = thread.getByRole("list", { name: "常用语" });
    const log = page.getByRole("log", { name: "消息记录" });
    await expect(job).toBeVisible();
    await expect(activity).toBeVisible();
    await expect(phrases).toBeVisible();
    const input = page.getByLabel("输入消息");

    // What a keyboard of about 290 px leaves of the screen. T1 left the messages 86 px there (brief-B-15); #405 147.
    const bar = (await job.boundingBox())!.height;
    const folded = bar + (await activity.boundingBox())!.height + (await phrases.boundingBox())!.height;
    const height = async () => Math.round((await log.boundingBox())!.height);
    const down = await height();
    await input.focus();
    await page.setViewportSize({ width: PHONE.width, height: 377 });
    await expect(job).toBeHidden();
    await expect(activity).toBeHidden();
    await expect(phrases).toBeHidden();
    // Settled: the chat follows the visible window on its resize event.
    await expect.poll(() => (async () => (await thread.boundingBox())!.height)()).toBeLessThanOrEqual(377);
    const up = await height();
    await page.screenshot({ path: testInfo.outputPath("keyboard-up.png") });
    const numbers = `bar ${bar}, folded ${folded}, log down ${down}, log with the keyboard up ${up}`;
    testInfo.annotations.push({ type: "log height", description: numbers });
    console.log(`#415 ${testInfo.project.name}: ${numbers}`);
    expect(up).toBeGreaterThanOrEqual(86 + folded - 2);

    // The keyboard goes down (the window is tall again), or the box loses the focus: they are back.
    await page.setViewportSize(PHONE);
    await expect(job).toBeVisible();
    await expect(activity).toBeVisible();
    await expect(phrases).toBeVisible();
    await page.setViewportSize({ width: PHONE.width, height: 377 });
    await expect(job).toBeHidden();
    await input.blur();
    await expect(job).toBeVisible();
    await expect(phrases).toBeVisible();

    // A field in 管理常用语 has the keyboard too: the row folds, its dialog stays.
    await page.setViewportSize(PHONE);
    await thread.getByRole("button", { name: "管理常用语和开场白" }).click();
    const dialog = page.getByRole("dialog", { name: "常用语和开场白" });
    const field = dialog.getByLabel("常用语 1", { exact: true });
    await field.focus();
    await page.setViewportSize({ width: PHONE.width, height: 377 });
    await expect(phrases).toBeHidden();
    await expect(dialog).toBeVisible();
    await expect(field).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    await page.setViewportSize(PHONE);
    await expect(phrases).toBeVisible();
    await expect(thread.getByRole("button", { name: "管理常用语和开场白" })).toBeFocused();
    await waitForTitle(page);
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual(
      [],
    );
  });
});
