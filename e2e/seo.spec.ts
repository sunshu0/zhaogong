import { expect, test } from "@playwright/test";

// R-32: what search engines get. The rules are unit-tested in src/lib/site.test.ts and job-posting.test.ts;
// these check that the routes and the job page really serve them.

test("sitemap.xml lists open jobs and hiring businesses, and nothing personal", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.ok()).toBe(true);
  const xml = await response.text();
  expect(xml).toContain("<urlset");
  expect(xml).toMatch(/<loc>https?:\/\/[^<]+\/jobs\/j1<\/loc>/);
  expect(xml).toMatch(/<loc>https?:\/\/[^<]+\/employers\/e1<\/loc>/);
  for (const path of ["/admin", "/me", "/messages", "/profile", "/candidates/"]) expect(xml).not.toContain(path);
});

test("robots.txt keeps personal pages and tools out and points at the sitemap", async ({ request }) => {
  const text = await (await request.get("/robots.txt")).text();
  for (const path of ["/admin", "/me", "/messages", "/profile", "/candidates/", "/employer/"])
    expect(text).toContain(`Disallow: ${path}`);
  expect(text).toMatch(/Sitemap: https?:\/\/\S+\/sitemap\.xml/);
});

test("an open job page carries JobPosting data without contact details", async ({ page }) => {
  await page.goto("/jobs/j1");
  const script = page.locator('script[type="application/ld+json"]');
  await expect(script).toHaveCount(1);
  const data = JSON.parse((await script.textContent())!);
  expect(data).toMatchObject({
    "@type": "JobPosting",
    title: "前厅服务员",
    hiringOrganization: { name: "川味小馆" },
    baseSalary: { currency: "NZD" },
  });
  expect(Date.parse(data.validThrough)).toBeGreaterThan(Date.now());
  for (const detail of ["021 ••• 0101", "demo_chuanwei"]) expect(JSON.stringify(data)).not.toContain(detail);
});
