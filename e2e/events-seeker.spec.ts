import { expect, test, type Page } from "@playwright/test";
import { freshEmail, signIn } from "./helpers";

// The job seeker's funnel events (#319, ADR 0025 §4): each page and action sends its event to /api/events, with the
// route template, the job and the detail the catalog allows, and nothing a person wrote.

/** The funnel event `name` on its way to /api/events, with what it carries (as external.spec.ts). */
const eventSent = (page: Page, name: string) =>
  page
    .waitForRequest((r) => r.url().endsWith("/api/events") && (r.postData() ?? "").includes(`"name":"${name}"`))
    .then((r) => JSON.parse(r.postData()!) as Record<string, string>);

test("signed out: the home page, the list, a search, a job and 立即沟通 send their events", async ({ page }) => {
  let sent = eventSent(page, "home_view");
  await page.goto("/");
  expect(await sent).toEqual({ name: "home_view", path: "/" });

  sent = eventSent(page, "jobs_list_view");
  await page.goto("/jobs");
  expect(await sent).toEqual({ name: "jobs_list_view", path: "/jobs", detail: "all" });

  sent = eventSent(page, "jobs_search");
  const search = page.getByRole("searchbox", { name: "搜索职位" });
  await search.fill("点心");
  await search.press("Enter");
  // The filter's name only, never the words searched.
  expect(await sent).toEqual({ name: "jobs_search", path: "/jobs", detail: "q" });

  sent = eventSent(page, "jobs_list_view");
  await page.goto("/jobs?industry=hospitality");
  expect(await sent).toEqual({ name: "jobs_list_view", path: "/jobs", detail: "filtered" });

  sent = eventSent(page, "job_view");
  await page.goto("/jobs/j3");
  expect(await sent).toEqual({ name: "job_view", path: "/jobs/[id]", jobId: "j3" });

  sent = eventSent(page, "chat_start");
  await page.getByRole("main").getByRole("link", { name: "立即沟通", exact: true }).click();
  expect(await sent).toEqual({ name: "chat_start", path: "/jobs/[id]", jobId: "j3", detail: "signed_out" });
});

test("signed in: 立即沟通 sends its event (申请 and its events are gone, user 10-20)", async ({ page }) => {
  await signIn(page, "/jobs/j3", freshEmail("events.seeker"));

  const sent = eventSent(page, "chat_start");
  await page.getByRole("button", { name: "立即沟通", exact: true }).click();
  expect(await sent).toEqual({ name: "chat_start", path: "/jobs/[id]", jobId: "j3" });
  await expect(page).toHaveURL(/conversation=/);
});
