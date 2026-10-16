import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// 实习 and 专业职位 (#113): the demo external jobs (src/mock/external-jobs.ts) a moderator already approved.
// Read-only, so both projects can share the server; other specs may approve more, so no counts are relied on.

async function expectNoViolations(page: Page, state: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const found = violations.map(
    (v) => `${v.id} (${v.impact}): ${v.help}\n${v.nodes.map((n) => `    ${n.target.join(" ")}`).join("\n")}`,
  );
  expect.soft(found, `${state}\n${found.join("\n")}`).toEqual([]);
}

const list = (page: Page) => page.getByRole("region", { name: /列表$/ });

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
  await form.getByLabel("领域").selectOption({ label: "电子电气" });
  await form.getByLabel("签证").selectOption({ label: "原文写明需要身份或工作权利" });
  await form.getByRole("button", { name: "筛选" }).click();
  await expect(page).toHaveURL(/field=electrical/);
  await expect(list(page).getByRole("link", { name: "Power Electronics Engineer" })).toBeVisible();
  await expect(list(page).getByRole("link", { name: "Full Stack Developer" })).toHaveCount(0);
  await expectNoViolations(page, "/professional filtered");
});

test("实习 shows internships and graduate programmes; a job page has facts, 原文未说明 and 去官网申请 only", async ({
  page,
}) => {
  await page.goto("/internships");
  await expect(page.getByRole("heading", { level: 1, name: "实习" })).toBeVisible();
  await expectNoViolations(page, "/internships");
  await list(page).getByRole("link", { name: "Firmware Intern (Summer 2026/27)" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Firmware Intern (Summer 2026/27)" })).toBeVisible();
  // Next keeps the list page hidden in the DOM after the client navigation: look inside the job's article.
  const job = page.getByRole("article", { name: "Firmware Intern (Summer 2026/27)" });
  await expect(job.getByText(/^外部职位 · 来自 Kōwhai Robotics 官网 · 信息取于/)).toBeVisible();
  const facts = job.getByRole("region", { name: "职位信息（按官网原文整理）" });
  await expect(facts).toContainText("实习");
  await expect(facts).toContainText("签证原文未说明");
  await expect(facts).toContainText("$30 起 NZD 每小时");
  const apply = job.getByRole("link", { name: "去官网申请（新窗口）" });
  await expect(apply).toHaveAttribute("href", "https://example.com/demo-kowhai/jobs/4005");
  await expect(apply).toHaveAttribute("target", "_blank");
  await expect(apply).toHaveAttribute("rel", /noopener/);
  // Not a 找工 job: no apply, chat or contact details here.
  await expect(page.getByRole("button", { name: /^申请|立即沟通|查看联系方式/ })).toHaveCount(0);
  await expectNoViolations(page, "/external/[id]");

  // A job waiting for review has no page (the not-found page streams in after the shell, so the status stays 200).
  await page.goto(`/external/${encodeURIComponent("demo-kowhai:4002")}`);
  await expect(page.getByText("This page could not be found.")).toBeVisible();
  await expect(page.getByText("Senior Electronics Engineer")).toHaveCount(0);
});
