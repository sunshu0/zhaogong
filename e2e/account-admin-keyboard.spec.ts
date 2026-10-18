import { expect, test, type Page } from "@playwright/test";
import { freshEmail, signIn } from "./helpers";
import { moderatorPage } from "./employer/helpers";

// #189: line C's pages with the keyboard only — sign up as an employer, delete an account, and work the moderation
// queue's forms. Every Tab stop shows its focus and is not hidden under the sticky header or bottom bar (as in
// employer/keyboard.spec), and a form that takes the place of its button takes the focus with it, and gives it back.

test.use({ reducedMotion: "reduce" });

type Focused = { label: string; visible: boolean; obscured: boolean };

async function focused(page: Page): Promise<Focused> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return { label: "(body)", visible: false, obscured: false };
    const s = getComputedStyle(el);
    const visible =
      (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || (s.boxShadow !== "none" && s.boxShadow !== "");
    const labelled = el.id ? document.querySelector(`label[for="${el.id}"]`)?.textContent : undefined;
    // A Select's button (Round 19) is named by its label and its value: aria-labelledby.
    const labelledBy = el
      .getAttribute("aria-labelledby")
      ?.split(" ")
      .map((id) => document.getElementById(id)?.textContent ?? "")
      .join(" ");
    const label = (
      el.getAttribute("aria-label") ||
      labelled ||
      labelledBy ||
      el.closest("label")?.textContent ||
      el.textContent ||
      el.tagName
    )
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 30);
    const r = el.getBoundingClientRect();
    const header = document.querySelector("body > header")?.getBoundingClientRect();
    const bar = document.querySelector(".sticky.bottom-0");
    const barRect = bar && !bar.contains(el) ? bar.getBoundingClientRect() : undefined;
    const inHeader = !!document.querySelector("body > header")?.contains(el);
    const obscured =
      (!inHeader && header ? r.top < header.bottom - 1 : false) || (barRect ? r.bottom > barRect.top + 1 : false);
    return { label, visible, obscured };
  });
}

/** Presses Tab until `done` says the focus has arrived, checking every stop on the way. */
async function tabUntil(page: Page, done: (f: Focused) => boolean, max = 80): Promise<Focused[]> {
  const stops: Focused[] = [];
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    const f = await focused(page);
    stops.push(f);
    expect.soft(f.visible, `focus not visible on "${f.label}"`).toBe(true);
    expect.soft(f.obscured, `"${f.label}" is hidden under the header or the bottom bar`).toBe(false);
    if (done(f)) return stops;
  }
  throw new Error(`Tab never reached the target; stops: ${stops.map((s) => s.label).join(" | ")}`);
}

/** Presses an arrow key until the focused radio or tab is the one wanted. */
async function arrowTo(page: Page, key: "ArrowDown" | "ArrowRight", target: ReturnType<Page["getByRole"]>) {
  for (let i = 0; i < 12; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press(key);
  }
  await expect(target).toBeFocused();
}

test("sign up as an employer with the keyboard only: the role, email, code, a new business and its 地区", async ({
  page,
}, testInfo) => {
  await page.goto("/login");
  await expect(page.getByLabel("邮箱", { exact: true })).toBeVisible();
  await page.getByRole("banner").getByRole("link").first().focus();

  // The two roles are one Tab stop; the arrow keys choose.
  await tabUntil(page, (f) => f.label.startsWith("我要找工作"));
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("radio", { name: /我要招人/ })).toBeChecked();
  await tabUntil(page, (f) => f.label === "邮箱");
  await page.keyboard.insertText(freshEmail("kbd.employer"));
  await page.keyboard.press("Enter");

  const code = page.getByLabel("验证码");
  await expect(code).toBeFocused();
  await page.keyboard.insertText((await page.getByTestId("dev-sign-in-code").textContent())!.trim());
  await page.keyboard.press("Enter");

  // The business step takes the focus 登录 had.
  await expect(page.getByRole("heading", { name: "开通雇主身份" })).toBeFocused();
  await tabUntil(page, (f) => f.label.length > 0 && f.label !== "(body)");
  await arrowTo(page, "ArrowDown", page.getByRole("radio", { name: /新建企业/ }));
  await expect(page.getByRole("radio", { name: /新建企业/ })).toBeChecked();
  await tabUntil(page, (f) => f.label.startsWith("店名"));
  await page.keyboard.insertText(`键盘店${testInfo.project.name === "mobile" ? "M" : "D"}${Date.now() % 1_000_000}`);

  // 地区 (a Select): Enter opens the list, the arrow keys move, Enter picks.
  await tabUntil(page, (f) => f.label.startsWith("地区"));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("listbox", { name: "地区", exact: true })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("listbox", { name: "地区", exact: true })).toBeHidden();
  await expect(page.getByRole("button", { name: /^地区/ })).not.toContainText("请选择");

  await tabUntil(page, (f) => f.label === "开通并开始发布招聘");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/employer/post");
});

test("数据与账号: delete the account with the keyboard only", async ({ page }) => {
  const email = await signIn(page, "/account/data", freshEmail("kbd.delete"));
  await expect(page.getByLabel(/输入你的登录邮箱/)).toBeVisible();
  await page.getByRole("banner").getByRole("link").first().focus();
  await tabUntil(page, (f) => f.label === "下载我的数据");
  await tabUntil(page, (f) => f.label.startsWith("输入你的登录邮箱"));
  await page.keyboard.insertText(email);
  await tabUntil(page, (f) => f.label === "永久删除账号");
  await page.keyboard.press("Enter");
  await expect(page.getByText("账号已删除")).toBeVisible();
});

test("审核后台 with the keyboard only: tabs by arrow keys; 不显示 and 停用 take the focus in and give it back", async ({
  browser,
}, testInfo) => {
  const admin = await moderatorPage(browser, testInfo);
  await admin.goto("/admin");
  const first = admin.getByRole("tab", { name: /^发布时被标记/ });
  await expect(first).toBeVisible();
  await first.focus();
  const external = admin.getByRole("tab", { name: /^外部职位/ });
  await arrowTo(admin, "ArrowRight", external);
  await expect(external).toHaveAttribute("aria-selected", "true");
  await expect(admin.getByRole("heading", { name: /^待审核 \d+$/ })).toBeVisible();

  // A job's 不显示: the reasons take the focus; 取消 gives it back to the button. Nothing is submitted.
  const job = admin.getByRole("article", { name: /^外部职位：/ }).first();
  const hide = job.getByRole("button", { name: /^(不显示|撤下，不再显示)$/ });
  await tabUntil(admin, (f) => /^(不显示|撤下，不再显示)$/.test(f.label));
  await expect(hide).toBeFocused();
  await admin.keyboard.press("Enter");
  await expect(job.getByRole("radio").first()).toBeFocused();
  await admin.keyboard.press("ArrowDown");
  await expect(job.getByRole("radio").nth(1)).toBeChecked();
  await tabUntil(admin, (f) => f.label.startsWith("说明"));
  await admin.keyboard.insertText("键盘走查，不提交");
  await tabUntil(admin, (f) => f.label === "取消");
  await admin.keyboard.press("Enter");
  await expect(hide).toBeFocused();

  // A company's 停用 (or 恢复导入): the same.
  const company = admin.getByRole("article", { name: /^外部公司：/ }).first();
  const stop = company.getByRole("button", { name: /^(停用|恢复导入)$/ });
  await tabUntil(admin, (f) => /^(停用|恢复导入)$/.test(f.label));
  await expect(stop).toBeFocused();
  await admin.keyboard.press("Enter");
  await expect(company.getByRole("group").getByRole("textbox").first()).toBeFocused();
  await tabUntil(admin, (f) => f.label === "取消");
  await admin.keyboard.press("Enter");
  await expect(stop).toBeFocused();

  // The focus goes back to the button that opened the form, not the row's first one: 公司要求删除 next to 停用.
  await tabUntil(admin, (f) => f.label === "公司要求删除");
  const name = (await admin.locator("article:has(:focus)").getAttribute("aria-label")) ?? "";
  expect(name).toMatch(/^外部公司：/);
  const row = admin.getByRole("article", { name, exact: true });
  const takedown = row.getByRole("button", { name: "公司要求删除" });
  await expect(takedown).toBeFocused();
  await admin.keyboard.press("Enter");
  await expect(row.getByRole("group").getByRole("textbox").first()).toBeFocused();
  await tabUntil(admin, (f) => f.label === "取消");
  await admin.keyboard.press("Enter");
  await expect(takedown).toBeFocused();
  await admin.context().close();
});
