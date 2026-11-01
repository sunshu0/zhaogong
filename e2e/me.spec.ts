import { expect, test } from "@playwright/test";
import { freshEmail, signIn } from "./helpers";

test("/me (浏览与举报) lists jobs viewed and reports sent and clears history; 我的 signs out", async ({ page }) => {
  await page.goto("/me");
  await expect(page.getByText("登录后可以查看浏览记录和举报记录").filter({ visible: true })).toBeVisible();

  // A view is written once the page has taken over (RecordView's effect); the heading is already in the server's
  // HTML, so leaving as soon as it shows could skip the record (#66). 举报这个职位 is enabled from that point on.
  const report = page.getByRole("button", { name: "举报这个职位" });
  await page.goto("/jobs/j3");
  await expect(page.getByRole("heading", { level: 1, name: "点心师傅" })).toBeVisible();
  await expect(report).toBeEnabled();
  await page.goto("/jobs/j11");
  await expect(page.getByRole("heading", { level: 1, name: "仓库拣货员" })).toBeVisible();
  await expect(report).toBeEnabled();

  await page.getByRole("button", { name: "举报这个职位" }).click();
  await page.getByRole("group", { name: "举报这个职位" }).getByLabel("虚假职位").check();
  await page.getByRole("button", { name: "提交举报" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText("谢谢你的举报");

  const email = await signIn(page, "/me", freshEmail("demo.me")); // starts with 林晓's demo page (#125)
  await expect(page.getByRole("heading", { level: 1, name: "浏览与举报" })).toBeVisible();

  const viewed = page.getByRole("region", { name: /最近看过的职位/ });
  await expect(viewed.getByRole("listitem")).toHaveCount(2);
  await expect(viewed.getByRole("listitem").first()).toContainText("仓库拣货员");
  await expect(viewed.getByRole("listitem").nth(1)).toContainText("点心师傅");

  const reports = page.getByRole("region", { name: /我发出的举报/ });
  await expect(reports).toContainText("仓库拣货员");
  await expect(reports).toContainText("虚假职位 · 已提交");

  // S2 (#390): sent before signing in, so it carries the visitor's key; signed in, 我的举报 still finds it open.
  await reports.getByRole("link", { name: "看处理进度" }).click();
  await expect(page).toHaveURL("/me/reports");
  await expect(page.getByRole("region", { name: "职位举报" }).getByRole("listitem")).toContainText("虚假职位 · 处理中");
  await page.goto("/me");

  // It asks once, in the row (UI audit 3); 取消 keeps the history and the focus comes back.
  await viewed.getByRole("button", { name: "清除浏览记录" }).click();
  await viewed.getByRole("button", { name: "取消" }).click();
  await expect(viewed.getByRole("button", { name: "清除浏览记录" })).toBeFocused();
  await viewed.getByRole("button", { name: "清除浏览记录" }).click();
  await expect(viewed.getByRole("button", { name: "确认清除" })).toBeFocused();
  await viewed.getByRole("button", { name: "确认清除" }).click();
  await expect(viewed).toContainText("还没有看过职位。");
  // The confirm went with the list: the focus is on the panel's heading and the status line says so.
  await expect(viewed.getByRole("heading", { name: "最近看过的职位" })).toBeFocused();
  await expect(viewed.getByRole("status")).toHaveText("浏览记录已清除。");

  await page.goto("/account");
  await expect(page.getByText(email, { exact: true }).filter({ visible: true })).toBeVisible();
  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page).toHaveURL("/jobs");
  await expect(page.getByRole("banner").getByRole("button", { name: /^账号菜单/ })).toHaveCount(0);
});
