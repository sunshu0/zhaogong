import { expect, test } from "@playwright/test";

// User feedback 10-30 #4: a job section with no job is not put forward as if it had some. The tests' data has jobs
// in both sections, so the cookie zg_e2e_empty_sections empties one (src/lib/external-jobs/section-counts.ts).
test("a section with no job says 筹备中 in the header, on the job list and in the footer, and comes last", async ({
  page,
  baseURL,
}, testInfo) => {
  await page.goto("/jobs");
  await expect(page.getByText("筹备中")).toHaveCount(0);

  await page.context().addCookies([{ name: "zg_e2e_empty_sections", value: "internship", url: baseURL! }]);
  await page.goto("/jobs");
  // The header's links are there from 768 px; phones have the bottom bar.
  if (testInfo.project.name === "desktop")
    await expect(page.getByRole("navigation", { name: "主导航" }).getByRole("link")).toHaveText([
      "找工作",
      "专业职位",
      "实习筹备中",
    ]);
  await expect(
    page.getByRole("navigation", { name: "外部职位分区" }).getByRole("link", { name: /实习/ }),
  ).toContainText("筹备中");
  // The footer's job links are there from 1024 px (V6, #376).
  if (testInfo.project.name === "desktop") {
    await expect(page.locator("footer").getByRole("link", { name: /实习/ })).toContainText("筹备中");
    await expect(page.locator("footer").getByRole("link", { name: "专业职位", exact: true })).toBeVisible();
  }
});
