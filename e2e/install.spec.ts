import { expect, test } from "@playwright/test";

// What Chrome reads from the manifest when deciding to offer 安装 / 添加到主屏幕. (Page.getInstallabilityErrors is
// not used: in this Chromium it reports no errors even for a page with no manifest at all.)
test("Chrome parses the web app manifest: name, standalone, start URL, theme colour, icons", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");

  const cdp = await page.context().newCDPSession(page);
  const { url, errors, manifest } = await cdp.send("Page.getAppManifest");
  expect(errors).toEqual([]);
  expect(url).toMatch(/\/manifest\.webmanifest$/);
  expect(manifest?.name).toBe("找工 · 奥克兰中文工作");
  expect(manifest?.display).toBe("kStandalone");
  expect(manifest?.startUrl).toMatch(/:8702\/$/);
  expect(manifest?.themeColor).toBe("rgba(15,118,110,1)");

  const icons = manifest?.icons ?? [];
  expect(icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  for (const icon of icons) {
    const response = await page.request.get(icon.url);
    expect(response.status(), icon.url).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
  }
});
