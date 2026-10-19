import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// #324: 关于找工, reached from the footer of any page, with the minimum wage read from the country's settings.
test.use({ reducedMotion: "reduce" });

test("the footer links to 关于找工, 隐私说明 and 使用条款; the about page states the rules every job keeps", async ({
  page,
}) => {
  await page.goto("/jobs");
  const links = page.locator("footer").getByRole("navigation", { name: "关于和法律信息" });
  await expect(links.getByRole("link", { name: "隐私说明" })).toHaveAttribute("href", "/privacy");
  await expect(links.getByRole("link", { name: "使用条款" })).toHaveAttribute("href", "/terms");
  await links.getByRole("link", { name: "关于找工" }).click();
  await expect(page).toHaveURL("/about");

  const about = page.getByRole("article", { name: "关于找工" });
  await expect(about.getByRole("heading", { level: 1, name: "关于找工" })).toBeVisible();
  await expect(about).toContainText("现在成人每小时 $23.95");
  await expect(about).toContainText("找工不提供签证或移民建议");
  await expect(about.getByRole("link", { name: /谁可以提供移民建议/ })).toHaveAttribute(
    "href",
    "https://www.iaa.govt.nz/for-migrants/who-can-give-advice/",
  );
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(violations).toEqual([]);
});
