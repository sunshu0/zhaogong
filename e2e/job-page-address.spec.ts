import { expect, test } from "@playwright/test";

// #90: layout.spec's 查看联系方式 → /jobs/j1#contact failed once under load. Before #79 the view count set the
// visitor cookie in its own answer; a Server Function answer that sets a cookie makes Next refresh the page, and the
// refresh writes the router's address back without the #contact the plain link had added. Since #79 the page
// hands out the cookie, so the count's answer, however late, sets none and leaves the address alone.
test("a view count answering after 查看联系方式 sets no cookie and keeps #contact", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "The bar with 查看联系方式 is the phone layout; one run is enough");
  let countSetCookie!: (value: string | undefined) => void;
  const counted = new Promise<string | undefined>((resolve) => (countSetCookie = resolve));
  await page.route("**/jobs/j1", async (route) => {
    const request = route.request();
    if (request.method() !== "POST" || !request.postData()?.includes('"j1"')) return route.continue();
    await new Promise((resolve) => setTimeout(resolve, 1500)); // answers after the tap, as on a loaded server
    const response = await route.fetch();
    await route.fulfill({ response });
    countSetCookie(response.headers()["set-cookie"]);
  });

  await page.goto("/jobs/j1"); // contact details public
  await expect(page.getByRole("button", { name: "举报这个职位" })).toBeEnabled();
  await page.getByRole("link", { name: "查看联系方式", exact: true }).click();
  await expect(page).toHaveURL("/jobs/j1#contact");
  expect(await counted).toBeUndefined();
  await expect(page).toHaveURL("/jobs/j1#contact");
});
