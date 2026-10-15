import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openOptionalProfile } from "../helpers";
import { publishJob, signUpEmployer, uniqueTitle } from "./helpers";

test("recommends by selected job, explains matches and opens a persistent role-specific chat", async ({
  page,
}, testInfo) => {
  const shop = await signUpEmployer(page, testInfo, "/employer/candidates");
  await expect(page.getByRole("heading", { name: "暂无招聘中的职位" })).toBeVisible();
  const title = uniqueTitle("前厅服务员", testInfo);
  const id = await publishJob(page, title);
  await publishJob(
    page,
    uniqueTitle("厨房帮工", testInfo),
    "Mt Eden 餐馆招厨房帮工，时薪 $25-27，每周 35-40 小时，全职，包工作餐，开放工签可做，需会普通话，负责备菜、洗碗和厨房清洁，微信 demo_candidate",
  );
  // 推荐人才 is on 我的 (and in the desktop header), no longer a card on the workspace.
  await page.goto("/account");
  await expect(
    page
      .getByRole("main")
      .getByRole("link", { name: /^推荐人才/ })
      .last(),
  ).toBeVisible();
  await page.goto("/employer/candidates");
  await page.getByLabel("招聘职位").selectOption(id!);
  const rows = page.getByRole("article");
  await expect(rows.first().getByRole("heading", { name: "林晓" })).toBeVisible();
  // Five facts on every card, in the order of the candidate page (C6).
  await expect(rows.first().locator("dt")).toHaveText(["可上班时间", "地区", "期望时薪", "语言", "经验"]);
  await expect(rows.first()).toContainText("$25 起");
  // Scores below 40 are folded at the bottom, not hidden.
  await expect(rows).toHaveCount(3);
  const low = page.getByRole("button", { name: "另外 3 位匹配度较低" });
  await expect(low).toHaveAttribute("aria-expanded", "false");
  await low.click();
  await expect(rows).toHaveCount(6);
  await expect(rows.last().getByRole("heading")).toBeVisible();
  await low.click();
  await rows.first().getByRole("button", { name: "简历与匹配分析" }).click();
  await expect(rows.first().getByRole("region", { name: "匹配分析", exact: true })).toContainText("用工形式");
  await page.screenshot({ path: testInfo.outputPath("candidates.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  await page.getByLabel("最低匹配分").selectOption("80");
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({ has: page.getByRole("heading", { name: "王宁", exact: true }) })).toHaveCount(0);
  await page.getByLabel("搜索求职者").fill("无此求职者");
  await expect(page.getByText("暂无符合条件的求职者")).toBeVisible();
  await page.getByLabel("搜索求职者").fill("");
  await page.getByLabel("最低匹配分").selectOption("0");
  const kitchen = await page
    .getByLabel("招聘职位")
    .locator("option")
    .filter({ hasText: "厨房帮工" })
    .getAttribute("value");
  await page.getByLabel("招聘职位").selectOption(kitchen!);
  await expect(rows.first().getByRole("heading", { name: "王宁" })).toBeVisible();
  await page.getByLabel("招聘职位").selectOption(id!);
  await rows.first().getByRole("button", { name: "发起聊天" }).click();
  await expect(page).toHaveURL(/\/messages\?conversation=/);
  const log = page.getByRole("log", { name: "消息记录" });
  await expect(log).toContainText("尚未发送消息");
  await page.getByLabel("输入消息").fill("你好，我们正在招前厅服务员，方便聊聊吗？");
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await page.reload();
  await expect(log).toContainText("方便聊聊吗");
  const conversationUrl = page.url();
  await page.getByRole("link", { name: "查看林晓的主页", exact: true }).click();
  await expect(page).toHaveURL("/candidates/candidate-lin");
  await expect(page.getByRole("heading", { name: "林晓", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "返回聊天", exact: true }).click();
  await expect(page).toHaveURL(conversationUrl);
  await expect(log).toContainText("方便聊聊吗");
  await expect(page.getByRole("link", { name: /^聊的职位：/ })).toHaveAttribute("href", `/jobs/${id}`);
  await page.goto("/employer/candidates");
  await page.getByLabel("招聘职位").selectOption(id!);
  await rows.first().getByRole("button", { name: "发起聊天" }).click();
  if (testInfo.project.name === "mobile") await page.getByRole("button", { name: "返回会话列表", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "聊天列表" }).getByRole("button", { name: /林晓/ })).toHaveCount(
    2,
  );
  await page.getByRole("complementary", { name: "聊天列表" }).getByRole("button", { name: /林晓/ }).first().click();
  await expect(log).toContainText("方便聊聊吗");
  await page
    .getByRole("banner")
    .getByRole("button", { name: /^账号菜单/ })
    .click();
  await page.getByRole("button", { name: "切换为求职者", exact: true }).click();
  await page.goto("/messages");
  await expect(page.getByRole("complementary", { name: "聊天列表" })).not.toContainText(title);
  await page.goto("/profile");
  await page.getByLabel("经验（年）").fill("3");
  await openOptionalProfile(page);
  await page.getByLabel("最少小时", { exact: true }).fill("15");
  await page.getByLabel("最多小时", { exact: true }).fill("25");
  await page.getByLabel("允许向雇主推荐我的求职主页").check();
  await page.reload();
  await expect(page.getByLabel("允许向雇主推荐我的求职主页")).toBeChecked();
  await openOptionalProfile(page);
  await expect(page.getByLabel("最少小时", { exact: true })).toHaveValue("15");
  await page.screenshot({ path: testInfo.outputPath("resume-editor.png"), fullPage: true });
  await page
    .getByRole("banner")
    .getByRole("button", { name: /^账号菜单/ })
    .click();
  await page.getByRole("button", { name: `切换为雇主（${shop}）`, exact: true }).click();
  await page.goto("/employer/candidates");
  await expect(page.getByText("公开主页", { exact: true })).toHaveCount(0);
  await page.evaluate(() => {
    const key = "zhaogong:profiles-by-identity";
    const stored = JSON.parse(localStorage.getItem(key) ?? "{}");
    const profiles = stored.identities ?? stored; // versioned since A23
    profiles[JSON.stringify(["public-candidate@example.com", "seeker", null])] = {
      name: "公开候选人",
      contactName: "",
      headline: "前厅服务",
      location: "Mt Eden",
      languages: "普通话",
      availability: "周末",
      bio: "有点餐收银经验",
      resume: {
        candidateId: "public-demo",
        discoverable: true,
        skills: "点餐、收银",
        employmentTypes: ["part_time"],
        regionIds: ["akl-mt-eden"],
      },
    };
    localStorage.setItem(key, JSON.stringify(stored));
    window.dispatchEvent(new StorageEvent("storage", { key }));
  });
  // Half a profile scores low, so it is folded at the bottom (not hidden): open the fold to see it.
  await page.getByRole("button", { name: /^另外 \d+ 位匹配度较低/ }).click();
  await expect(page.getByRole("heading", { name: "公开候选人", exact: true })).toBeVisible();
  await page.evaluate(() => {
    const key = "zhaogong:profiles-by-identity";
    const stored = JSON.parse(localStorage.getItem(key)!);
    (stored.identities ?? stored)[
      JSON.stringify(["public-candidate@example.com", "seeker", null])
    ].resume.discoverable = false;
    localStorage.setItem(key, JSON.stringify(stored));
    window.dispatchEvent(new StorageEvent("storage", { key }));
  });
  await expect(page.getByRole("heading", { name: "公开候选人", exact: true })).toHaveCount(0);
});
