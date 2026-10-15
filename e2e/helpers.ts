import { expect, type Page } from "@playwright/test";

/** Signs in through /login like a user would: any email, then any six-digit code. */
export async function signIn(page: Page, next: string, email = "e2e.seeker@example.com") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("邮箱", { exact: true }).fill(email);
  await page.getByRole("button", { name: "获取验证码" }).click();
  await page.getByLabel("验证码").fill("123456");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(next);
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
