import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { chooseOption } from "./helpers";
import { waitForTitle } from "./helpers/title";

// 实习 and 专业职位 (#113): the demo external jobs (src/mock/external-jobs.ts) a moderator already approved.
// Read-only, so both projects can share the server; other specs may approve more, so no counts are relied on.

async function expectNoViolations(page: Page, state: string) {
  await waitForTitle(page);
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const found = violations.map(
    (v) => `${v.id} (${v.impact}): ${v.help}\n${v.nodes.map((n) => `    ${n.target.join(" ")}`).join("\n")}`,
  );
  expect.soft(found, `${state}\n${found.join("\n")}`).toEqual([]);
}

const list = (page: Page) => page.getByRole("region", { name: /列表$/ });
/** The funnel event `name` on its way to /api/events (#314, ADR 0025), with what it carries. */
const eventSent = (page: Page, name: string) =>
  page
    .waitForRequest((r) => r.url().endsWith("/api/events") && (r.postData() ?? "").includes(`"name":"${name}"`))
    .then((r) => JSON.parse(r.postData()!) as Record<string, string>);

test("专业职位 lists approved external jobs only, with the source, and filters without JavaScript state", async ({
  page,
}) => {
  await page.goto("/professional");
  await expect(page.getByRole("heading", { level: 1, name: "专业职位" })).toBeVisible();
  await expect(list(page).getByRole("link", { name: "Full Stack Developer" })).toBeVisible();
  await expect(list(page).getByRole("link", { name: "Power Electronics Engineer" })).toBeVisible();
  // Waiting for review (or hidden): not shown.
  await expect(list(page).getByText("Senior Electronics Engineer")).toHaveCount(0);
  // Internships are in the other section.
  await expect(list(page).getByText("Graduate Software Engineer")).toHaveCount(0);
  await expect(list(page).getByText(/^外部职位 · 来自 Tūī Software 官网 · 信息取于 \d+月\d+日$/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "公司要求删除" })).toBeVisible();
  await expectNoViolations(page, "/professional");

  const form = page.getByRole("form", { name: "筛选" });
  await chooseOption(page, form, "领域", "电子电气");
  await chooseOption(page, form, "签证", "原文写明需要身份或工作权利");
  await form.getByRole("button", { name: "筛选" }).click();
  await expect(page).toHaveURL(/field=electrical/);
  await expect(list(page).getByRole("link", { name: "Power Electronics Engineer" })).toBeVisible();
  await expect(list(page).getByRole("link", { name: "Full Stack Developer" })).toHaveCount(0);
  await expectNoViolations(page, "/professional filtered");
});

test("实习 shows internships and graduate programmes; a job page has facts, 原文未说明 and 去官网申请 only", async ({
  page,
}) => {
  const listed = eventSent(page, "external_list_view");
  await page.goto("/internships");
  await expect(page.getByRole("heading", { level: 1, name: "实习" })).toBeVisible();
  expect(await listed).toEqual({ name: "external_list_view", path: "/internships", detail: "internship" });
  await expectNoViolations(page, "/internships");
  const viewed = eventSent(page, "external_view");
  await list(page).getByRole("link", { name: "Firmware Intern (Summer 2026/27)" }).click();
  expect(await viewed).toEqual({ name: "external_view", path: "/external/[id]", jobId: "demo-kowhai:4005" });

  await expect(page.getByRole("heading", { level: 1, name: "Firmware Intern (Summer 2026/27)" })).toBeVisible();
  // Next keeps the list page hidden in the DOM after the client navigation: look inside the job's article.
  const job = page.getByRole("article", { name: "Firmware Intern (Summer 2026/27)" });
  await expect(job.getByText(/^外部职位 · 来自 Kōwhai Robotics 官网 · 信息取于/)).toBeVisible();
  const facts = job.getByRole("region", { name: "职位信息（按官网原文整理）" });
  await expect(facts).toContainText("实习");
  await expect(facts).toContainText("签证原文未说明");
  await expect(facts).toContainText("$30 起 NZD 每小时");
  // A demo job has no company site: 去官网申请 explains that on the page and never links to example.com.
  await expect(page.locator('a[href*="example.com"]')).toHaveCount(0);
  const apply = job.getByRole("button", { name: "去官网申请", exact: true });
  await expect(apply).toHaveAttribute("aria-expanded", "false");
  const applied = eventSent(page, "external_apply_click");
  await apply.click();
  expect((await applied).detail).toBe("demo");
  await expect(apply).toHaveAttribute("aria-expanded", "true");
  await expect(job.getByRole("status")).toHaveText(
    "这是演示职位，没有真的官网申请页。真实职位会在新窗口打开公司官网的申请页面。",
  );
  // Not a 找工 job: no apply, chat or contact details here.
  await expect(page.getByRole("button", { name: /^申请|立即沟通|查看联系方式/ })).toHaveCount(0);
  await expectNoViolations(page, "/external/[id]");

  // A job waiting for review has no page (the not-found page streams in after the shell, so the status stays 200).
  await page.goto(`/external/${encodeURIComponent("demo-kowhai:4002")}`);
  await expect(page.getByRole("heading", { name: "这个页面不存在" })).toBeVisible();
  await expect(page.getByText("Senior Electronics Engineer")).toHaveCount(0);
});
