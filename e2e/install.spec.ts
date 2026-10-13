import { expect, test } from "@playwright/test";

// What Chrome reads from the manifest when deciding to offer 安装 / 添加到主屏幕. (Page.getInstallabilityErrors is
// not used: in this Chromium it reports no errors even for a page with no manifest at all.)
test("Chrome parses the web app manifest: name, standalone, start URL, theme colour, icons", async ({ page }) => {
  await page.goto("/jobs");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");

  const cdp = await page.context().newCDPSession(page);
  const { url, errors, manifest } = await cdp.send("Page.getAppManifest");
  expect(errors).toEqual([]);
  expect(url).toMatch(/\/manifest\.webmanifest$/);
  expect(manifest?.name).toBe("找工 · 奥克兰中文工作");
  expect(manifest?.display).toBe("kStandalone");
  expect(manifest?.startUrl).toBe(new URL("/jobs", page.url()).href); // the installed app opens on the list; any E2E_PORT
  expect(manifest?.themeColor).toBe("rgba(15,118,110,1)");

  const icons = manifest?.icons ?? [];
  expect(icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  for (const icon of icons) {
    const response = await page.request.get(icon.url);
    expect(response.status(), icon.url).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
  }
});

test.describe("iOS 添加到主屏幕", () => {
  test.use({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  });

  // Install tags live in the root <head> even when a job page streams its dynamic metadata.
  for (const path of ["/jobs", "/jobs/j3"]) {
    test(`${path} has the home-screen name and icon in <head>`, async ({ page }) => {
      await page.goto(path);
      const head = page.locator("head");
      await expect(head.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute("content", "找工");
      await expect(head.locator('meta[name="mobile-web-app-capable"]')).toHaveAttribute("content", "yes");
      await expect(head.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", "/icons/apple-touch-icon.png");
      await expect(head.locator('link[rel="icon"][href="/icons/favicon-32.png"]')).toHaveCount(1);
      await expect(head.locator('link[rel="manifest"]')).toHaveCount(1);

      for (const icon of ["/icons/apple-touch-icon.png", "/icons/favicon-32.png"]) {
        const response = await page.request.get(icon);
        expect(response.status(), icon).toBe(200);
        expect(response.headers()["content-type"]).toBe("image/png");
      }
    });
  }
});
