import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, type CookieJar } from "@/lib/auth";
import { setAuthStoreForTests } from "@/lib/auth/store";
import { jobNumbers } from "@/db/job-stats";
import { ensureAccount, openEmployerIdentity, updateJob } from "@/lib/data";

// Server Functions read the request's cookies; here one jar stands in for one browser.
const cookies = new Map<string, string>();
const jar: CookieJar = {
  get: (name) => (cookies.has(name) ? { name, value: cookies.get(name)! } : undefined),
  set: (name, value) => void cookies.set(name, value),
  delete: (name) => void cookies.delete(name),
};
vi.mock("next/headers", () => ({ cookies: async () => jar }));

const { countJobView } = await import("@/app/[lang]/employer/count-view");
const { proxy } = await import("@/proxy");
const { NextRequest } = await import("next/server");
const views = async (job: string) => (await jobNumbers([job]))[job].views;

beforeEach(() => {
  setAuthStoreForTests();
  cookies.clear();
});

describe("countJobView (#55)", () => {
  it("counts a browser's id once a day; another browser counts again", async () => {
    const before = await views("j2");
    cookies.set("zg_visitor", "a".repeat(22)); // from the job page (proxy)
    await countJobView("j2");
    await countJobView("j2");
    expect(await views("j2")).toBe(before + 1);

    cookies.set("zg_visitor", "b".repeat(22)); // another browser
    await countJobView("j2");
    expect(await views("j2")).toBe(before + 2);
  });

  it("never sets the cookie: a browser without one counts each view under a throw-away id (#90)", async () => {
    const before = await views("j2");
    await countJobView("j2");
    await countJobView("j2");
    // Setting a cookie in a Server Function's answer refreshes the page, which drops a #contact from the address.
    expect(cookies.has("zg_visitor")).toBe(false);
    expect(await views("j2")).toBe(before + 2);
    // Nor does the proxy on the Server Function's own request, which posts to the job page's path.
    const action = proxy(new NextRequest("http://localhost/jobs/j2", { method: "POST" }));
    expect(action.cookies.get("zg_visitor")).toBeUndefined();
  });

  it("counts a reload right after the first view once, even when the first count's answer is lost (#79)", async () => {
    const before = await views("j2");
    // The job page's own answer gives the browser its id (a GET for HTML, as a browser opening the page sends).
    const page = proxy(new NextRequest("http://localhost/jobs/j2", { headers: { accept: "text/html,*/*;q=0.8" } }));
    const id = page.cookies.get("zg_visitor")?.value;
    expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/);
    cookies.set("zg_visitor", id!);

    await countJobView("j2");
    // Whatever the count's answer would set never arrives: the browser keeps only what the page gave it.
    cookies.clear();
    cookies.set("zg_visitor", id!);
    await countJobView("j2"); // the reload
    expect(await views("j2")).toBe(before + 1);
  });

  it("does not count the business looking at its own job, or a job seekers cannot see", async () => {
    await openEmployerIdentity("owner.view@example.com", "e2");
    await createSession("owner.view@example.com", "seeker", jar);
    const ownBefore = await views("j4"); // e2's
    await countJobView("j4");
    expect(await views("j4")).toBe(ownBefore);

    cookies.clear();
    await ensureAccount("someone@example.com");
    await createSession("someone@example.com", "seeker", jar);
    await updateJob("j6", { status: "removed" });
    await countJobView("j6");
    await countJobView("no-such-job");
    expect(await views("j6")).toBe(0);
  });
});
