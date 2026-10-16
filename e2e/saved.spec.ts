import { expect, test } from "@playwright/test";
import { freshEmail, signIn, fillSignInCode } from "./helpers";

// #52 收藏和进度: saved per account on the server, stages only the account sees.
const saveButton = (page: import("@playwright/test").Page, title: string) =>
  page.getByRole("button", { name: `收藏：${title}`, exact: true }).filter({ visible: true });

test("收藏 signed out signs in and comes back saved; the list keeps stages and drops what is removed", async ({
  page,
}) => {
  // Signed out on the list: sign in first, then back on the same filtered list with the job saved.
  await page.goto("/jobs?industry=retail");
  await saveButton(page, "超市理货员").click();
  await expect(page).toHaveURL(/^.*\/login\?next=/);
  await page.getByLabel("邮箱", { exact: true }).fill(freshEmail("saved"));
  await page.getByRole("button", { name: "获取验证码" }).click();
  await fillSignInCode(page);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL("/jobs?industry=retail");
  await expect(saveButton(page, "超市理货员")).toHaveAttribute("aria-pressed", "true");

  // On a job page.
  await page.goto("/jobs/j3");
  await saveButton(page, "点心师傅").click();
  await expect(saveButton(page, "点心师傅")).toHaveAttribute("aria-pressed", "true");

  // 收藏和进度: newest first, 已收藏 to start with; a stage set stays after a reload.
  await page.goto("/me/saved");
  await expect(page.getByRole("heading", { level: 1, name: "收藏和进度" })).toBeVisible();
  const list = page.getByRole("list", { name: "收藏的职位" });
  await expect(list.getByRole("article")).toHaveCount(2);
  await expect(list.getByRole("heading", { level: 2 })).toHaveText(["点心师傅", "超市理货员"]);
  const dimSum = list.getByRole("article", { name: "点心师傅" });
  await expect(dimSum.getByLabel("进度")).toHaveValue("saved");
  await dimSum.getByLabel("进度").selectOption({ label: "已面试" });
  await expect(dimSum.getByLabel("进度")).toHaveValue("interviewed");
  await page.reload();
  await expect(list.getByRole("article", { name: "点心师傅" }).getByLabel("进度")).toHaveValue("interviewed");

  // Removing it from the list un-saves it on the job list too.
  await list.getByRole("article", { name: "超市理货员" }).getByRole("button", { name: "取消收藏" }).click();
  await expect(list.getByRole("article")).toHaveCount(1);
  await page.goto("/jobs?industry=retail");
  await expect(saveButton(page, "超市理货员")).toHaveAttribute("aria-pressed", "false");
});

test("a job whose chat swapped contact details shows 已联系; other accounts see none of it", async ({ page }) => {
  const email = await signIn(page, "/profile", freshEmail("demo.saved.chat"));
  await page.getByLabel("交换用电话", { exact: true }).fill("09 055 8802");
  await page.goto("/jobs/j3");
  await saveButton(page, "点心师傅").click();
  await expect(saveButton(page, "点心师傅")).toHaveAttribute("aria-pressed", "true");

  // The demo chat about j3 has the employer's contact details waiting; agree to swap.
  await page.goto("/messages?conversation=north-tea");
  const contact = page.getByRole("region", { name: "联系方式交换请求", exact: true });
  await contact.getByRole("button", { name: "查看并同意", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "同意并交换双方资料", exact: true }).click();
  await expect(contact).toContainText("双方已同意");

  await page.goto("/me/saved");
  const dimSum = page.getByRole("list", { name: "收藏的职位" }).getByRole("article", { name: "点心师傅" });
  await expect(dimSum.getByLabel("进度")).toHaveValue("contacted");
  await expect(dimSum).toContainText("聊天里交换过联系方式");
  await expect(page.getByText("只有你自己看得到，雇主看不到。")).toBeVisible();

  // Another account starts with nothing saved.
  await page.context().clearCookies();
  await signIn(page, "/me/saved", freshEmail("saved.other"));
  await expect(page.getByText("还没有收藏的职位")).toBeVisible();
  expect(email).toContain("saved.chat");
});
