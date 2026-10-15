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

const { countJobView } = await import("@/app/employer/count-view");
const views = async (job: string) => (await jobNumbers([job]))[job].views;

beforeEach(() => {
  setAuthStoreForTests();
  cookies.clear();
});

describe("countJobView (#55)", () => {
  it("gives the browser a random id and counts it once a day; another browser counts again", async () => {
    const before = await views("j2");
    await countJobView("j2");
    const visitor = cookies.get("zg_visitor");
    expect(visitor).toMatch(/^[A-Za-z0-9_-]{22}$/);
    await countJobView("j2");
    expect(cookies.get("zg_visitor")).toBe(visitor);
    expect(await views("j2")).toBe(before + 1);

    cookies.clear(); // another browser
    await countJobView("j2");
    expect(await views("j2")).toBe(before + 2);
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
