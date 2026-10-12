import { expect, test, type Page } from "@playwright/test";
import { CLEAN_MESSAGE, publishJob, uniqueTitle } from "./helpers";

// The whole post flow with the keyboard only: every control can be reached with Tab, shows a
// visible focus indicator, and is not hidden under the sticky header or the sticky bottom bar.

type Focused = { label: string; visible: boolean; obscured: boolean };

async function focused(page: Page): Promise<Focused> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return { label: "(body)", visible: false, obscured: false };
    const s = getComputedStyle(el);
    const visible = (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || (s.boxShadow !== "none" && s.boxShadow !== "");
    const labelled = el.id ? document.querySelector(`label[for="${el.id}"]`)?.textContent : undefined;
    const label = (el.getAttribute("aria-label") || labelled || el.closest("label")?.textContent || el.textContent || el.tagName).trim().replace(/\s+/g, " ").slice(0, 30);
    const r = el.getBoundingClientRect();
    const header = document.querySelector("body > header")?.getBoundingClientRect();
    const bar = document.querySelector(".sticky.bottom-0");
    const barRect = bar && !bar.contains(el) ? bar.getBoundingClientRect() : undefined;
    const inHeader = !!document.querySelector("body > header")?.contains(el);
    const obscured = (!inHeader && header ? r.top < header.bottom - 1 : false) || (barRect ? r.bottom > barRect.top + 1 : false);
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

test("post a job with the keyboard only", async ({ page }, testInfo) => {
  await page.goto("/employer/post");

  await tabUntil(page, (f) => f.label.startsWith("把微信群里的招聘消息粘贴进来"));
  await page.keyboard.insertText(CLEAN_MESSAGE);
  await tabUntil(page, (f) => f.label === "整理成职位");
  await page.keyboard.press("Enter");

  // The new step's heading takes focus, then every field is a Tab stop on the way to 预览.
  await expect(page.getByRole("heading", { name: "核对职位信息" })).toBeFocused();
  const stops = (await tabUntil(page, (f) => f.label === "预览")).map((s) => s.label);
  for (const field of [
    "职位名称（中文） *",
    "职位名称（英文） *",
    "行业 *",
    "兼职",
    "急招",
    "地区 *",
    "地址（可不填）",
    "最低",
    "最高（可不填）",
    "班次（可不填）",
    "包餐",
    "包住",
    "学签",
    "普通话",
    "中文描述 *",
    "英文描述 *",
    "按表格重新生成",
    "电话",
    "微信号",
    "邮箱",
  ]) {
    expect.soft(stops, `Tab never reaches ${field}`).toContain(field);
  }

  // A field changed from the keyboard still runs the checks.
  await page.getByLabel("职位名称（中文）").focus();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(uniqueTitle("前厅服务员键盘", testInfo));
  await page.getByRole("button", { name: "预览", exact: true }).focus();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: /^预览/ })).toBeFocused();
  await tabUntil(page, (f) => f.label === "邮箱");
  await page.keyboard.insertText("keyboard@example.com");
  await page.keyboard.press("Enter");
  await tabUntil(page, (f) => f.label === "验证码");
  await page.keyboard.insertText("123456");
  await tabUntil(page, (f) => f.label === "登录");
  await page.keyboard.press("Enter");
  await tabUntil(page, (f) => f.label === "发布");
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: "已发布" })).toBeFocused();
  await tabUntil(page, (f) => f.label.startsWith("复制微信群文案"));
});

test("tabs move with the arrow keys; confirming and the result keep the focus", async ({ page }, testInfo) => {
  const title = uniqueTitle("前厅服务员", testInfo);
  await publishJob(page, title);
  await page.goto("/employer/jobs");

  const all = page.getByRole("tab", { name: /^全部/ });
  await all.focus();
  await page.keyboard.press("ArrowRight");
  const active = page.getByRole("tab", { name: /^招聘中/ });
  await expect(active).toBeFocused();
  await expect(active).toHaveAttribute("aria-selected", "true");
  await expect(all).toHaveAttribute("tabindex", "-1");
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: /^已下架/ })).toBeFocused();
  await page.keyboard.press("Home");
  await expect(all).toBeFocused();

  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: title }) });
  await card.getByRole("button", { name: "结束招聘" }).focus();
  await page.keyboard.press("Enter");
  await expect(card.getByRole("button", { name: "确定结束招聘" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toBeFocused();
  await expect(page.getByRole("status")).toHaveText(`${title}：已结束招聘`);
});
