import { expect, test, type Page } from "@playwright/test";
import { freshEmail, signIn } from "./helpers";

// Reading and writing in the chat: each conversation keeps its own draft through a switch and a reload (#281).

const box = (page: Page) => page.getByLabel("输入消息");

test("a half-written message stays with its conversation through a switch and a reload, and goes once sent (#281)", async ({
  page,
}) => {
  await signIn(page, "/messages?conversation=north-tea", freshEmail("demo.drafts"));
  await expect(page.getByRole("log")).toBeVisible();
  await box(page).fill("北茶的草稿");

  await page.goto("/messages?conversation=mt-eden");
  await expect(box(page)).toHaveValue("");
  await box(page).fill("伊甸山的草稿");

  await page.goto("/messages?conversation=north-tea");
  await expect(box(page)).toHaveValue("北茶的草稿");
  await page.reload();
  await expect(box(page)).toHaveValue("北茶的草稿");

  await page.getByRole("button", { name: "发送", exact: true }).click();
  await expect(box(page)).toHaveValue("");
  await expect(page.getByRole("log")).toContainText("北茶的草稿");
  await page.reload();
  await expect(box(page)).toHaveValue("");

  await page.goto("/messages?conversation=mt-eden");
  await expect(box(page)).toHaveValue("伊甸山的草稿");
});
