import { expect, test, type Page } from "@playwright/test";
import { chooseOption, fillSignInCode, freshEmail, selectTrigger, signIn } from "./helpers";

// 收藏 and 职位提醒 for 实习 and 专业职位 (#131): the demo external jobs a moderator already approved
// (src/mock/external-jobs.ts). Nothing here approves or hides a job, so both projects can share the server; the
// notification a moderator's 通过 sends is in src/app/[lang]/me/alerts/external-alerts.test.ts.

const saveButton = (page: Page, title: string) =>
  page.getByRole("button", { name: `收藏：${title}` }).filter({ visible: true });

test("收藏 an external job signed out: sign in, back on the section with it saved; 收藏和进度 keeps it", async ({
  page,
}) => {
  await page.goto("/professional?field=software");
  await saveButton(page, "Full Stack Developer").click();
  await expect(page).toHaveURL(/^.*\/login\?next=/);
  await page.getByLabel("邮箱", { exact: true }).fill(freshEmail("ext.saved"));
  await page.getByRole("button", { name: "获取验证码" }).click();
  await fillSignInCode(page);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL("/professional?field=software");
  await expect(saveButton(page, "Full Stack Developer")).toHaveAttribute("aria-pressed", "true");
  await expect(saveButton(page, "Full Stack Developer")).not.toHaveAttribute("aria-busy");

  // On a job page too, and the list shows both, newest first, as 外部职位.
  await page.goto("/internships");
  await page
    .getByRole("region", { name: "实习列表" })
    .getByRole("link", { name: "Graduate Software Engineer" })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Graduate Software Engineer" })).toBeVisible();
  await saveButton(page, "Graduate Software Engineer").click();
  await expect(saveButton(page, "Graduate Software Engineer")).toHaveAttribute("aria-pressed", "true");
  await expect(saveButton(page, "Graduate Software Engineer")).not.toHaveAttribute("aria-busy");

  await page.goto("/me/saved");
  const list = page.getByRole("list", { name: "收藏的职位" });
  await expect(list.getByRole("heading", { level: 2 })).toHaveText([
    /^Graduate Software Engineer外部职位$/,
    /^Full Stack Developer外部职位$/,
  ]);
  const grad = list.getByRole("article", { name: "Graduate Software Engineer" });
  await expect(grad).toContainText("Kōwhai Robotics");
  await chooseOption(page, grad, "进度", "已面试");
  await expect(selectTrigger(grad, "进度")).toHaveAccessibleName("进度 已面试");
  await page.reload();
  await expect(
    selectTrigger(list.getByRole("article", { name: "Graduate Software Engineer" }), "进度"),
  ).toHaveAccessibleName("进度 已面试");
  await expect(grad.getByRole("link", { name: "Graduate Software Engineer" })).toHaveAttribute(
    "href",
    "/external/demo-kowhai%3A4001",
  );

  await list.getByRole("article", { name: "Full Stack Developer" }).getByRole("button", { name: "取消收藏" }).click();
  await expect(list.getByRole("article")).toHaveCount(1);
  await page.goto("/professional");
  await expect(saveButton(page, "Full Stack Developer")).toHaveAttribute("aria-pressed", "false");
  await expect(saveButton(page, "Full Stack Developer")).not.toHaveAttribute("aria-busy");
});

test("a section's filters become an alert, listed with its section; 看职位 opens the same filtered list", async ({
  page,
}) => {
  await signIn(page, "/professional", freshEmail("ext.alert"));
  await page.goto("/professional?city=christchurch&field=electrical");
  await page.getByRole("button", { name: "保存为提醒" }).click();
  await expect(page.getByRole("status")).toContainText("已保存为提醒");
  await page.goto("/professional?field=electrical&city=christchurch");
  await page.getByRole("button", { name: "保存为提醒" }).click();
  await expect(page.getByRole("status")).toContainText("已经是提醒了");

  await page.goto("/me/alerts");
  const alert = page.getByRole("article", { name: "提醒：专业职位：电子电气、基督城" });
  await expect(alert).toContainText("专业职位 · 外部职位");
  await expect(alert).toContainText("电子电气 · 基督城");
  await alert.getByRole("link", { name: "看职位" }).click();
  await expect(page).toHaveURL("/professional?field=electrical&city=christchurch");
  await expect(
    page.getByRole("region", { name: "专业职位列表" }).getByRole("link", { name: "Power Electronics Engineer" }),
  ).toBeVisible();
});
