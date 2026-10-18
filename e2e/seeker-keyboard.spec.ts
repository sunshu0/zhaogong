import { expect, test, type Locator, type Page } from "@playwright/test";
import { freshEmail, selectTrigger, signIn } from "./helpers";

// The job seeker's controls with the keyboard only (#179): the filter sheet, a Select, 收藏 and 申请. The employer
// side has its own (employer/keyboard.spec.ts).

/** The focused element shows a focus indicator: an outline (the browser's own ring counts) or a ring shadow. */
async function expectVisibleFocus(page: Page, target: Locator) {
  await expect(target).toBeFocused();
  const shown = await page.evaluate(() => {
    const s = getComputedStyle(document.activeElement as Element);
    return (
      (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || (s.boxShadow !== "none" && s.boxShadow !== "")
    );
  });
  expect(shown, "a visible focus indicator").toBe(true);
}

/**
 * Focuses `target` the way a keyboard user gets there: focus() alone after a mouse click would not show the ring
 * (:focus-visible follows the last input), so step off with Shift+Tab and back with Tab.
 */
async function keyboardFocus(page: Page, target: Locator) {
  await target.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expectVisibleFocus(page, target);
}

test("筛选: the sheet opens from the keyboard, keeps the focus inside, and Esc gives it back", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "the filters are a bottom sheet below 1024px only");
  await page.goto("/jobs");
  const open = page.getByRole("button", { name: /^筛选/ }).filter({ visible: true });
  await expect(open).toBeEnabled(); // it waits for hydration (#90)
  await keyboardFocus(page, open);
  await page.keyboard.press("Enter");
  const sheet = page.locator("dialog[open]");
  await expect(sheet).toBeVisible();
  // A modal dialog: Tab moves among the sheet's own controls, never to the page behind it.
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest("dialog[open]"))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(open).toBeFocused();
});

test("a Select from the keyboard: an arrow opens it, End and Enter pick, Esc closes and keeps the value", async ({
  page,
}) => {
  await page.goto("/internships");
  const field = selectTrigger(page.getByRole("form", { name: "筛选" }), "领域");
  await expect(field).toBeVisible();
  await keyboardFocus(page, field);

  // A dropdown from 768px, a bottom sheet below: the same listbox and the same keys.
  await page.keyboard.press("ArrowDown");
  const list = page.getByRole("listbox", { name: "领域", exact: true });
  await expect(list).toBeVisible();
  const last = ((await list.getByRole("option").last().textContent()) ?? "").trim();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(list).toBeHidden();
  await expect(field).toHaveAccessibleName(`领域 ${last}`);
  await expect(field).toBeFocused();

  await page.keyboard.press("ArrowDown");
  await expect(list).toBeVisible();
  await page.keyboard.press("Home");
  await page.keyboard.press("Escape");
  await expect(list).toBeHidden();
  await expect(field).toHaveAccessibleName(`领域 ${last}`);
  await expect(field).toBeFocused();
});

test("收藏 and 申请 on a job card work from the keyboard", async ({ page }, testInfo) => {
  await signIn(page, "/jobs", freshEmail("keyboard.save"));
  const save = page
    .getByRole("button", { name: /^收藏：/ })
    .filter({ visible: true })
    .first();
  await expect(save).toBeEnabled();
  await keyboardFocus(page, save);
  // The focus stays on 收藏 while the server answers (it used to be disabled then, which dropped the focus).
  await page.keyboard.press("Enter");
  await expect(save).toHaveAttribute("aria-pressed", "true");
  await expect(save).not.toHaveAttribute("aria-busy");
  await expect(save).toBeFocused();
  await page.keyboard.press(" ");
  await expect(save).toHaveAttribute("aria-pressed", "false");
  await expect(save).not.toHaveAttribute("aria-busy");
  await expect(save).toBeFocused();

  // 申请 is on the card from 768px; on a phone it is in the job page's bottom bar.
  if (testInfo.project.name !== "desktop") return;
  const apply = page
    .getByRole("button", { name: /^申请：/ })
    .filter({ visible: true })
    .first();
  await keyboardFocus(page, apply);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/jobs\/j\w+\?apply=1$/);
  await expect(page.getByRole("dialog", { name: "申请这个职位" })).toBeVisible();
});

test("职位提醒 from the keyboard: a working button keeps the focus, one that goes hands it on (#202)", async ({
  page,
}) => {
  await signIn(page, "/jobs?industry=retail", freshEmail("keyboard.alerts"));
  // 保存为提醒 turns into 已保存为提醒 with 管理提醒, which gets the focus.
  await keyboardFocus(page, page.getByRole("button", { name: "保存为提醒" }));
  await page.keyboard.press("Enter");
  const manage = page.getByRole("status").getByRole("link", { name: "管理提醒" });
  await expect(manage).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/me/alerts");

  // 暂停 stays where it is: the focus stays on it while the server answers, and it reads 恢复提醒 after.
  const alert = page.getByRole("article", { name: /^提醒：/ });
  await keyboardFocus(page, alert.getByRole("button", { name: "暂停" }));
  await page.keyboard.press("Enter");
  const resume = alert.getByRole("button", { name: "恢复提醒" });
  await expect(resume).not.toHaveAttribute("aria-busy");
  await expect(resume).toBeFocused();

  // The name form closes after 保存: the focus goes back to 改名.
  const rename = alert.getByRole("button", { name: "改名" });
  await keyboardFocus(page, rename);
  await page.keyboard.press("Enter");
  await page.getByLabel("提醒名称").fill("键盘改的名字");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("article", { name: "提醒：键盘改的名字" })).toBeVisible();
  await expect(rename).toBeFocused();

  // A deleted alert takes its buttons with it: the focus goes to the line above the list.
  await keyboardFocus(page, alert.getByRole("button", { name: "删除" }));
  await page.keyboard.press("Enter");
  await alert.getByRole("button", { name: "确认删除" }).press("Enter");
  await expect(alert).toBeHidden();
  await expect(page.getByText(/^有新职位符合条件时/)).toBeFocused();
});
