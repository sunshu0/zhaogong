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

/** A fresh address for one test: a code can be asked for once a minute per email, and specs run side by side. */
export function freshEmail(tag = "e2e.seeker") {
  return `${tag}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;
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

/** Opens a workspace page (通知, 我的主页 …) the way a user would, without reloading: the sidebar on desktop, 我的 on phones. */
export async function openWorkspacePage(page: Page, label: string) {
  const sidebar = page.getByRole("navigation", { name: "工作台导航" }).filter({ visible: true });
  if (await sidebar.count()) {
    await sidebar.getByRole("link", { name: label, exact: true }).click();
    return;
  }
  await siteNav(page).getByRole("link", { name: "我的", exact: true }).click();
  await expect(page).toHaveURL("/account");
  await page
    .getByRole("main")
    .getByRole("link", { name: new RegExp(`^${label}`) })
    .click();
}

/** An item of the open chat's 更多 menu (雇主主页 / 求职者主页, 查看职位, 举报), opened the way a user would. */
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

/** Profile edits save as you type: to the account for a job seeker (#104), in this browser for a 企业主页. */
export async function expectProfileSaved(page: Page) {
  await expect(page.getByText(/^(已保存到你的账号|已自动保存到本机)/)).toBeVisible();
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
export async function chooseOption(page: Page, scope: Page | Locator, label: string, option: string) {
  await scope.getByRole("button", { name: new RegExp(`^${label}`) }).click();
  await page
    .getByRole("listbox", { name: label, exact: true })
    .getByRole("option", { name: option, exact: true })
    .click();
}
