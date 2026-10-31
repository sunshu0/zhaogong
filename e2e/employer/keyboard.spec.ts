import { expect, test, type Page } from "@playwright/test";
import { chatAboutJob, freshEmail, signIn } from "../helpers";
import {
  CLEAN_MESSAGE,
  candidateCard,
  lastAssistant,
  publishJob,
  signUpEmployer,
  uniqueCjkTitle,
  uniqueTitle,
} from "./helpers";

// The whole post flow with the keyboard only: every control can be reached with Tab, shows a
// visible focus indicator, and is not hidden under the sticky header or the sticky bottom bar.

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

/** Holds this page's Server Function calls (POSTs to `path`) until the returned release() is called (#202). */
async function holdCalls(page: Page, path: string): Promise<() => void> {
  let release = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  let held = true;
  await page.route(
    (url) => url.pathname === path,
    async (route) => {
      if (held && route.request().method() === "POST") await gate;
      await route.fallback();
    },
  );
  return () => {
    held = false;
    release();
  };
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
  await signUpEmployer(page, testInfo);
  await page.goto("/employer/post");
  // The page shows once the employer identity is read from the session; wait, then start Tab from the
  // top (after a reload Chrome may start sequential focus anywhere on the page).
  await expect(page.getByRole("button", { name: "直接填表", exact: true })).toBeVisible();
  await page.getByRole("banner").getByRole("link").first().focus();

  await tabUntil(page, (f) => f.label === "直接填表");
  await page.keyboard.press("Enter");
  await tabUntil(page, (f) => f.label.startsWith("把微信群里的招聘消息粘贴进来"));
  await page.keyboard.insertText(CLEAN_MESSAGE);
  await tabUntil(page, (f) => f.label === "整理成职位");
  await page.keyboard.press("Enter");

  // The new step's heading takes focus, then every field is a Tab stop on the way to 预览.
  await expect(page.getByRole("heading", { name: "核对职位信息" })).toBeFocused();
  const stops = (await tabUntil(page, (f) => f.label === "预览")).map((s) => s.label);
  for (const field of [
    "职位名称（中文） *（必填）",
    "职位名称（英文） *（必填）",
    "兼职",
    "急招",
    "地址（可不填）",
    "最低",
    "最高（可不填）",
    "班次（可不填）",
    "包餐",
    "包住",
    "学签",
    "普通话",
    "中文描述 *（必填）",
    "英文描述 *（必填）",
    "按表格重新生成",
    "企业主页",
  ]) {
    expect.soft(stops, `Tab never reaches ${field}`).toContain(field);
  }
  // 行业 and 地区 are Selects (Round 19), named by their label and value.
  expect.soft(stops.some((label) => label.startsWith("行业 "))).toBe(true);
  expect.soft(stops.some((label) => label.startsWith("地区 "))).toBe(true);
  // The contact choice is one radio group (private by default), reached by Tab like the rest.
  expect.soft(stops.some((label) => label.startsWith("不公开，求职者在聊天中申请交换"))).toBe(true);

  // A field changed from the keyboard still runs the checks.
  await page.getByLabel("职位名称（中文）").focus();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(uniqueTitle("前厅服务员键盘", testInfo));
  await page.getByRole("button", { name: "预览", exact: true }).focus();
  await page.keyboard.press("Enter");

  await expect(page.getByText(/^预览：/)).toBeFocused();
  await tabUntil(page, (f) => f.label === "发布");
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: "已发布" })).toBeFocused();
  await tabUntil(page, (f) => f.label.startsWith("复制微信群文案"));
});

test("tabs move with the arrow keys; confirming and the result keep the focus", async ({ page }, testInfo) => {
  const title = uniqueTitle("前厅服务员", testInfo);
  await signUpEmployer(page, testInfo);
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
  // 结束招聘 is under 更多: Enter opens the menu on its first item, End goes to the last.
  await card.getByRole("button", { name: /^更多操作/ }).focus();
  await page.keyboard.press("Enter");
  await expect(card.getByRole("menuitem").first()).toBeFocused();
  await page.keyboard.press("End");
  await expect(card.getByRole("menuitem", { name: "结束招聘" })).toBeFocused();
  await page.keyboard.press("Enter");
  // The optional hires question opens with focus on its first choice; Space answers, Tab moves on.
  await expect(card.getByLabel("招到了")).toBeFocused();
  await page.keyboard.press("Space");
  // 招到的人数 is a Select (Round 19): ↓ opens its options, ↓ moves to 2 人, Enter picks it.
  await tabUntil(page, (f) => f.label.startsWith("招到的人数"));
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("listbox", { name: "招到的人数" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await tabUntil(page, (f) => f.label === "确定结束招聘");
  // #202: while the answer is on its way the button stays focused and busy, not disabled.
  const release = await holdCalls(page, "/employer/jobs");
  await page.keyboard.press("Enter");
  const end = card.getByRole("button", { name: "确定结束招聘" });
  await expect(end).toHaveAttribute("aria-busy", "true");
  await expect(end).toBeFocused();
  release();
  await expect(page.getByRole("status")).toBeFocused();
  await expect(page.getByRole("status")).toHaveText(`${title}：已结束招聘，已招到 2 人`);
});

test("取消 on a job card's question gives the focus back (#248)", async ({ page }, testInfo) => {
  const title = uniqueTitle("前厅服务员", testInfo);
  await signUpEmployer(page, testInfo);
  await publishJob(page, title);
  await page.goto("/employer/jobs");

  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: title }) });
  const more = card.getByRole("button", { name: /^更多操作/ });
  await more.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("End");
  await expect(card.getByRole("menuitem", { name: "结束招聘" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(card.getByLabel("招到了")).toBeFocused();
  await card.getByRole("button", { name: "取消", exact: true }).click();
  await expect(more).toBeFocused();
  // The team row's confirm step is in team.spec.ts: since #296 only a team with a second admin offers 退出团队.
});

test("聊过的人: a mark shows busy while it is on its way, and one that takes the card out of 未处理 moves the focus on (#256)", async ({
  page,
  browser,
}, testInfo) => {
  await signUpEmployer(page, testInfo);
  const jobId = (await publishJob(page, uniqueTitle("前厅服务员", testInfo)))!;
  // A job seeker writes about the job, so it has someone who chatted (ADR 0030).
  const seeker = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  await signIn(seeker, `/jobs/${jobId}`, freshEmail("e2e.keys"));
  await chatAboutJob(seeker, jobId);
  await seeker.context().close();

  const path = `/employer/jobs/${jobId}/applicants`;
  await candidateCard(page, jobId);
  const filters = page.getByRole("tablist", { name: "按处理状态" });
  await filters.getByRole("tab", { name: "未处理 1" }).click();
  const applicant = page.getByRole("article", { name: "候选人 求职者" });
  const fit = applicant.getByRole("button", { name: "合适", exact: true });
  await fit.focus();
  const release = await holdCalls(page, path);
  await page.keyboard.press("Enter");
  // On its way: the pressed mark is busy and keeps the focus; the card's other marks wait.
  await expect(fit).toHaveAttribute("aria-busy", "true");
  await expect(fit).toBeFocused();
  await expect(applicant.getByRole("button", { name: "不合适" })).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Enter");
  release();
  // 合适 takes the card out of 未处理; with nobody after it, the focus goes to the filter's own tab.
  await expect(applicant).toHaveCount(0);
  await expect(filters.getByRole("tab", { name: "未处理 0" })).toBeFocused();
  await filters.getByRole("tab", { name: "合适 1" }).click();
  // Pressed twice, sent once: still 合适, not taken back off.
  await expect(fit).toHaveAttribute("aria-pressed", "true");
});

test("团队: 保存称呼 keeps the focus while it saves, then the notice takes it (#202)", async ({ page }, testInfo) => {
  await signUpEmployer(page, testInfo, "/employer/team");
  const name = page.getByLabel(/^称呼/);
  await name.fill("小王");
  const release = await holdCalls(page, "/employer/team");
  await tabUntil(page, (f) => f.label === "保存称呼");
  await page.keyboard.press("Enter");
  const save = page.getByRole("button", { name: "保存称呼" });
  await expect(save).toHaveAttribute("aria-busy", "true");
  await expect(save).toBeFocused();
  release();
  const notice = page.getByRole("status").filter({ hasText: "称呼已保存。" });
  await expect(notice).toBeFocused();
});

test("chat with the keyboard only: type, Enter, Shift+Tab to the quick replies", async ({ page }, testInfo) => {
  const title = uniqueCjkTitle("厨师", testInfo);
  await signUpEmployer(page, testInfo);
  await page.goto("/employer/post");
  await expect(page.getByLabel("回复助手")).toBeVisible();
  await page.getByRole("banner").getByRole("link").first().focus();
  await tabUntil(page, (f) => f.label === "回复助手");
  await page.keyboard.insertText(`Mt Eden 川菜馆招${title}，全职，时薪 $28-30，包工作餐，学签可做。微信 demo_kbd_chat`);
  await page.keyboard.press("Enter");

  const box = page.getByLabel("回复助手");
  await expect(lastAssistant(page)).toContainText("每周大概多少小时");
  await expect(box).toBeFocused();

  // The quick replies sit just before the reply box. They show once the turn has finished (not while it is pending),
  // which can be a moment after the reply text: other Server Function calls (the job card's pay reference, #85) go
  // one at a time with the chat's.
  await expect(page.getByRole("group", { name: "快捷回复" })).toBeVisible();
  await page.keyboard.press("Shift+Tab");
  const chip = await focused(page);
  expect(chip.label).toBe("不固定");
  expect(chip.visible).toBe(true);
  await page.keyboard.press("Enter");
  await expect(lastAssistant(page)).toContainText("都齐了");
  await expect(box).toBeFocused();

  for (let i = 0; i < 4; i++) await page.keyboard.press("Shift+Tab");
  expect((await focused(page)).label).toBe("预览并发布");
  await page.keyboard.press("Enter");
  await expect(page.getByText(/^预览：/)).toBeFocused();
});
