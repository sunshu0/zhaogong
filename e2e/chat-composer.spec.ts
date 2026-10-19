import { expect, test } from "@playwright/test";
import { freshEmail, signIn } from "./helpers";

// The chat's message box stops at the server's limit and shows the count near it (#259).
test("the message box stops at 2000 characters and counts near the limit (#259)", async ({ page }) => {
  await signIn(page, "/messages?conversation=north-tea", freshEmail("demo.composer"));
  const log = page.getByRole("log");
  await expect(log).toBeVisible();
  const box = page.getByLabel("输入消息");

  // #259: no count while far from the limit; the count from 1800, and nothing past 2000.
  await box.fill("短消息");
  await expect(page.getByText(/\d+\/2000/)).toHaveCount(0);
  await box.fill("长".repeat(1850));
  await expect(page.getByText("1850/2000")).toBeVisible();
  await box.fill("长".repeat(2100));
  await expect(box).toHaveValue("长".repeat(2000));
  await expect(page.getByText("2000/2000")).toBeVisible();
});
