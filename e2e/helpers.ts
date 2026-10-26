import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Types the sign-in code. Codes are random (A12-1); outside production the sign-in page shows the code, which is
 * what a developer reads from the server log.
 */
export async function fillSignInCode(page: Page) {
  const shown = page.getByTestId("dev-sign-in-code");
  await expect(shown).toHaveText(/^\d{6}$/);
  await page.getByLabel("验证码").fill((await shown.textContent())!.trim());
}

/**
 * The session cookie's name (src/lib/auth/config.ts sessionCookieName): `__Host-zg_session` in a production build,
 * the browser tests' build included (E2E_SERVER=start); `zg_session` on next dev.
 */
export const SESSION_COOKIE_NAME = process.env.E2E_SERVER === "start" ? "__Host-zg_session" : "zg_session";

/** A fresh address for one test: a code can be asked for once a minute per email, and specs run side by side. */
export function freshEmail(tag = "e2e.seeker") {
  return `${tag}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;
}

/**
 * The page's signed-in job seeker writes to the business from the job's page (立即沟通), which makes them one of the
 * job's 聊过的人 (ADR 0030; 申请 went 10-20 11:0x). Ends in the conversation. The business sees them as 「求职者」
 * until they save a page on their account.
 */
export async function chatAboutJob(page: Page, jobId: string, text = "你好，这个职位还招人吗？"): Promise<void> {
  await page.goto(`/jobs/${jobId}`);
  await page.getByRole("main").getByRole("button", { name: "立即沟通", exact: true }).click();
  await expect(page).toHaveURL(/\/messages\?conversation=employer%3A/);
  await page.getByLabel("输入消息").fill(text);
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await expect(page.getByRole("log", { name: "消息记录" })).toContainText(text);
}

/**
 * Opens a job from the job list by its card's link (#376). From 1280 px the click shows the job in the preview
 * column beside the list; its 查看完整页面 opens the page. Before the list's script runs the link opens it directly.
 */
export async function openFromList(page: Page, link: Locator) {
  const href = (await link.getAttribute("href"))!;
  await link.click();
  const full = page.getByRole("complementary", { name: "职位预览" }).getByRole("link", { name: "查看完整页面" });
  const onJob = () => new URL(page.url()).pathname === href;
  const previewed = async () => (await full.count()) > 0 && (await full.getAttribute("href")) === href;
  await expect.poll(async () => onJob() || (await previewed())).toBe(true);
  if (!onJob()) await full.click();
  await expect(page).toHaveURL(href);
}

/** Signs in through /login like a user would: an email, then the code it was sent; ends on `next`. */
export async function signIn(page: Page, next: string, email = freshEmail()) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("邮箱", { exact: true }).fill(email);
  await page.getByRole("button", { name: "获取验证码" }).click();
  await fillSignInCode(page);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(next);
  return email;
}

/** The visible contact block on a job page. */
export function contactBlock(page: Page) {
  return page.getByRole("region", { name: "联系方式" });
}

/** The site navigation in view: the header links from 768 px, the bottom bar on phones (Round 11, C2). */
export function siteNav(page: Page) {
  return page.getByRole("navigation", { name: /^(主导航|底部导航)$/ }).filter({ visible: true });
}

/** 聊天 in the site navigation. Its title carries the unread count, e.g. 「聊天，3 条未读消息」. */
export function chatEntry(page: Page) {
  return siteNav(page).getByRole("link", { name: "聊天", exact: true });
}

/**
 * T1 (ADR 0042): on a phone an open conversation fills the screen, without the site's header, footer or bottom bar.
 * Like a user, press ← to get back to the list (and them) first; elsewhere this does nothing.
 */
export async function leaveFullscreenChat(page: Page) {
  const back = page.getByRole("button", { name: "返回会话列表", exact: true });
  if (!(await back.isVisible())) return;
  await back.click();
  await expect(page.getByRole("banner")).toBeVisible();
}

/**
 * The unread count shown on 聊天, as its title (「聊天」, 「聊天，3 条未读消息」). In a phone's open conversation the
 * bottom bar is hidden (T1); the tab's title carries the same count there (#291, 「(3) …」, none when all are read).
 */
export async function expectChatUnread(page: Page, entryTitle: string) {
  if (!(await page.getByRole("button", { name: "返回会话列表", exact: true }).isVisible())) {
    await expect(chatEntry(page)).toHaveAttribute("title", entryTitle);
    return;
  }
  const count = /，(\d+) 条未读消息$/.exec(entryTitle)?.[1];
  if (count) await expect(page).toHaveTitle(new RegExp(`^\\(${count}\\) `));
  else await expect(page).not.toHaveTitle(/^\(\d+\) /);
}

/** Opens a workspace page (通知, 我的主页 …) the way a user would, without reloading: the sidebar on desktop, 我的 on phones. */
export async function openWorkspacePage(page: Page, label: string) {
  const sidebar = page.getByRole("navigation", { name: "工作台导航" }).filter({ visible: true });
  if (await sidebar.count()) {
    await sidebar.getByRole("link", { name: label, exact: true }).click();
    return;
  }
  await leaveFullscreenChat(page);
  await siteNav(page).getByRole("link", { name: "我的", exact: true }).click();
  await expect(page).toHaveURL("/account");
  await page
    .getByRole("main")
    .getByRole("link", { name: new RegExp(`^${label}`) })
    .click();
}

/** An item of the open chat's 更多 menu (企业主页 / 求职者主页, 查看职位, 举报), opened the way a user would. */
export async function chatMenuItem(page: Page, name: string) {
  await page
    .getByRole("button", { name: /^更多：/ })
    .filter({ visible: true })
    .click();
  return page.getByRole("menuitem", { name, exact: true });
}

/** A tool behind ＋ beside the message input (交换资料, 交换联系方式). */
export async function exchangeTool(page: Page, name: string) {
  const plus = page.getByRole("button", { name: "交换资料或联系方式" });
  if ((await plus.getAttribute("aria-expanded")) !== "true") await plus.click();
  return page.getByRole("group", { name: "沟通工具" }).getByRole("button", { name, exact: true });
}

/** Opens 选填资料 on /profile, which is folded by default (C4). */
export async function openOptionalProfile(page: Page) {
  const details = page.locator("details", { has: page.locator("summary", { hasText: "选填资料" }) });
  if (!(await details.evaluate((el) => (el as HTMLDetailsElement).open))) await details.locator("summary").click();
}

/** Profile edits save as you type: to the account for a job seeker (#104), to the business for a 企业主页 (ADR 0022). */
export async function expectProfileSaved(page: Page) {
  await expect(page.getByText(/^(已保存到你的账号|已保存到企业主页|已自动保存到本机)/)).toBeVisible();
}

/**
 * The demo counterpart of an open conversation reads my messages and/or replies (#10: chats live on the server;
 * POST /api/dev/chat-reply exists outside production only). The page reloads to show it.
 */
export async function counterpartActs(page: Page, conversationId: string, act: { reply?: string; readMine?: boolean }) {
  const response = await page.request.post("/api/dev/chat-reply", { data: { conversationId, ...act } });
  expect(response.ok()).toBe(true);
  await page.reload();
}

/**
 * Picks an option of a Select (Round 19, src/components/ui/Select.tsx): opens it by its label, then taps the option,
 * in the bottom sheet on a phone or the dropdown on a desktop.
 */
/** A Select's trigger (Round 19): its name is the label, then what it shows, e.g. 「进度 已面试」. */
export function selectTrigger(scope: Page | Locator, label: string) {
  return scope.getByRole("button", { name: new RegExp(`^${label} `) });
}

export async function chooseOption(page: Page, scope: Page | Locator, label: string, option: string) {
  await scope.getByRole("button", { name: new RegExp(`^${label}`) }).click();
  await page
    .getByRole("listbox", { name: label, exact: true })
    .getByRole("option", { name: option, exact: true })
    .click();
}
