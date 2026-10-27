import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { freshEmail, signIn } from "./helpers";
import { waitForTitle } from "./helpers/title";

// #413 操作手感第四件: on a phone the chat's panels (分享, 举报, 常用语, 发简历, 交换联系方式) and 更多 come up from
// the bottom, drag down or a tap on the dimmed page closes them, and the focus goes back to the button. From 768 px
// a centred panel and a dropdown, as before. ADR 0048.
test.use({ reducedMotion: "reduce" });

async function expectNoViolations(page: Page) {
  await waitForTitle(page);
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(violations).toEqual([]);
}

async function openShare(page: Page) {
  await page.goto("/jobs/j1");
  const share = page.getByRole("button", { name: "分享" });
  await expect(share).toBeEnabled(); // hydrated
  await share.click();
  const sheet = page.getByRole("dialog", { name: "分享给朋友" });
  await expect(sheet).toBeVisible();
  return { share, sheet };
}

/** Whether the panel's bottom edge is on the window's bottom edge (a bottom sheet) rather than above it (centred). */
async function onTheBottom(page: Page, panel: Locator) {
  const box = await panel.boundingBox();
  const height = page.viewportSize()!.height;
  return !!box && Math.abs(box.y + box.height - height) < 2;
}

/** Drags the sheet down by its title with a finger (touch events through Chromium's DevTools protocol). */
async function dragDown(page: Page, sheet: Locator, by: number) {
  const box = (await sheet.getByRole("heading").boundingBox())!;
  const x = Math.round(box.x + 8);
  const y = Math.round(box.y + box.height / 2);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let step = 1; step <= 6; step++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: y + Math.round((by * step) / 6) }],
    });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

async function openChat(page: Page) {
  await signIn(page, "/jobs", freshEmail("sheets.seeker"));
  await page.goto("/jobs/j1");
  await page.getByRole("main").getByRole("button", { name: "立即沟通", exact: true }).click();
  await expect(page).toHaveURL(/\/messages\?conversation=employer%3A/);
  return page.getByRole("button", { name: /^更多：/ }).filter({ visible: true });
}

test.describe("phone", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "the bottom sheets are below 768px only");
  });

  test("分享 comes up from the bottom; a tap on the dimmed page closes it and gives the focus back", async ({
    page,
  }) => {
    const { share, sheet } = await openShare(page);
    await expect.poll(() => onTheBottom(page, sheet)).toBe(true);
    await expect(sheet).toHaveAttribute("aria-modal", "true");
    await expectNoViolations(page);
    await page.mouse.click(10, 10);
    await expect(sheet).toBeHidden();
    await expect(share).toBeFocused();
  });

  test("a drag down closes 分享; a short one puts it back", async ({ page }) => {
    const { share, sheet } = await openShare(page);
    await dragDown(page, sheet, 20);
    await expect(sheet).toBeVisible();
    await expect.poll(() => onTheBottom(page, sheet)).toBe(true);
    await dragDown(page, sheet, 160);
    await expect(sheet).toBeHidden();
    await expect(share).toBeFocused();
  });

  test("the chat's 更多 is a sheet: the same menu, keys and focus; Esc or a drag closes it", async ({ page }) => {
    const more = await openChat(page);
    await more.click();
    const sheet = page.getByRole("dialog", { name: /^更多：/ });
    await expect(sheet).toBeVisible();
    await expect.poll(() => onTheBottom(page, sheet)).toBe(true);
    const items = sheet.getByRole("menu").getByRole("menuitem");
    await expect(items.first()).toBeFocused();
    await page.keyboard.press("End");
    await expect(items.last()).toBeFocused();
    await expectNoViolations(page);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(more).toBeFocused();

    await more.click();
    await expect(sheet).toBeVisible();
    await dragDown(page, sheet, 160);
    await expect(sheet).toBeHidden();
    await expect(more).toBeFocused();

    // 举报 from the sheet opens the report panel, itself a sheet, with the 更多 sheet gone.
    await more.click();
    await sheet.getByRole("menuitem", { name: "举报", exact: true }).click();
    const report = page.getByRole("dialog");
    await expect(report).toHaveCount(1);
    await expect(report).not.toHaveAccessibleName(/^更多：/);
    await expect.poll(() => onTheBottom(page, report)).toBe(true);
  });
});

test.describe("desktop", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "768px and up keep the centred panel and the dropdown");
  });

  test("分享 stays a centred panel that a click beside it leaves open", async ({ page }) => {
    const { sheet } = await openShare(page);
    await expect.poll(() => onTheBottom(page, sheet)).toBe(false);
    await page.mouse.click(10, 10);
    await expect(sheet).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  });

  test("the chat's 更多 stays a dropdown, not a dialog", async ({ page }) => {
    const more = await openChat(page);
    await more.click();
    await expect(page.getByRole("menu").getByRole("menuitem").first()).toBeFocused();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
