import { expect, test } from "@playwright/test";
import { freshEmail, signIn } from "./helpers";

// The chat's message box: it stops at the server's limit and shows the count near it (#259), and Ctrl/⌘+Enter
// sends while Enter alone is a new line (#260).
test("the message box stops at 2000 characters, counts near the limit, and Ctrl+Enter sends", async ({ page }) => {
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

  // #260: Enter is a new line; Ctrl+Enter sends and the focus stays in the box.
  await box.fill("第一行");
  await box.press("Enter");
  await box.pressSequentially("第二行");
  await expect(box).toHaveValue("第一行\n第二行");
  await box.press("Control+Enter");
  await expect(box).toHaveValue("");
  await expect(box).toBeFocused();
  await expect(log).toContainText("第二行");
  await expect(box).toHaveAttribute("aria-keyshortcuts", "Control+Enter Meta+Enter");
});
