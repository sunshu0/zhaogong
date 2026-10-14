import { expect, test } from "@playwright/test";
import { chatEntry, openWorkspacePage } from "./helpers";
import AxeBuilder from "@axe-core/playwright";
import { signUpEmployer } from "./employer/helpers";

test("seeker notifications open related threads and persist both read states", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("zhaogong:session"))
      localStorage.setItem(
        "zhaogong:session",
        JSON.stringify({
          email: "notifications@example.com",
          activeRole: "seeker",
          signedInAt: "2026-10-13T00:00:00Z",
        }),
      );
  });
  await page.goto("/notifications");
  const list = page.getByRole("region", { name: "通知列表" });
  await expect(list).toContainText("2 条未读");
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("notifications.png"), fullPage: true });
  const entry = chatEntry(page);
  for (const [title, id, person, remaining] of [
    ["北岸早茶酒家回复了你", "north-tea", "北岸早茶酒家", "1"],
    ["有一个职位适合你的资料", "mt-eden", "Mt Eden 餐馆", "0"],
    ["洁净家政查看了你的简历", "clean-home", "洁净家政", "0"],
  ]) {
    await list.getByRole("link", { name: new RegExp(title) }).click();
    await expect(page).toHaveURL(`/messages?conversation=${id}`);
    await expect(page.getByRole("region", { name: `与${person}的聊天` })).toBeVisible();
    await expect(entry).toHaveAttribute("title", remaining === "0" ? "聊天" : `聊天，${remaining} 条未读消息`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`notification-${id}.png`), fullPage: true });
    await openWorkspacePage(page, "通知");
  }
  await expect(list).toContainText("已全部读完");
  await page.reload();
  await expect(list).toContainText("已全部读完");
  await expect(entry).toHaveAttribute("title", "聊天");
});

test("legacy employer notifications open the right candidate, while bulk read stays on the list", async ({
  page,
}, testInfo) => {
  await signUpEmployer(page, testInfo, "/notifications");
  const list = page.getByRole("region", { name: "通知列表" });
  await expect(list).toContainText("2 条未读");
  await list.getByRole("link", { name: /林晓回复了你的面试邀请/ }).click();
  await expect(page).toHaveURL("/messages?conversation=candidate-lin");
  await expect(page.getByRole("region", { name: "与林晓的聊天" })).toBeVisible();
  // Simulate notifications saved before versioning (A23): whole lists, without navigation targets.
  await page.evaluate(() => {
    const key = "zhaogong:notifications-by-identity";
    const stored = JSON.parse(localStorage.getItem(key)!);
    const legacy = Object.fromEntries(
      Object.entries(stored.identities as Record<string, string[]>).map(([scope, read]) => [
        scope,
        read.map((id) => ({ id, type: "通知", title: "旧通知", detail: "", time: "昨天", unread: false })),
      ]),
    );
    localStorage.setItem(key, JSON.stringify(legacy));
    window.dispatchEvent(new StorageEvent("storage", { key }));
  });
  await openWorkspacePage(page, "通知");
  await expect(list).toContainText("1 条未读");
  await list.getByRole("link", { name: /陈雨发来了简历/ }).click();
  await expect(page).toHaveURL("/messages?conversation=candidate-chen");
  await expect(page.getByRole("region", { name: "与陈雨的聊天" })).toBeVisible();
  await page.goto("/notifications");
  await list.getByRole("link", { name: /招聘资料待完善/ }).click();
  await expect(page).toHaveURL("/profile");
  await expect(page.getByRole("heading", { name: "企业主页", level: 1 })).toBeVisible();

  await page
    .getByRole("banner")
    .getByRole("button", { name: /^账号菜单/ })
    .click();
  await page.getByRole("button", { name: "切换为求职者", exact: true }).click();
  await page.goto("/notifications");
  await expect(list).toContainText("2 条未读");
  await page.getByRole("button", { name: "全部标为已读" }).click();
  await expect(page).toHaveURL("/notifications");
  await expect(list).toContainText("已全部读完");
  await list.getByRole("link", { name: /北岸早茶酒家回复了你/ }).click();
  await expect(page).toHaveURL("/messages?conversation=north-tea");
  await expect(page.getByRole("region", { name: "与北岸早茶酒家的聊天" })).toBeVisible();
  await expect(page.getByRole("log")).not.toContainText("面试邀请");
});
