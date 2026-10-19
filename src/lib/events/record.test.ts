import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { database } from "@/db/ready";
import * as t from "@/db/schema";
import { PER_DAY, resetEventCleanupForTests } from "@/db/events";

// One browser: its cookies and the request's headers, as /api/events and Server Functions see them.
const cookies = new Map<string, string>();
let requestHeaders = new Headers();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookies.has(name) ? { name, value: cookies.get(name)! } : undefined),
    set: () => {},
    delete: () => {},
  }),
  headers: async () => requestHeaders,
}));

const { POST } = await import("@/app/api/events/route");
const { recordRequestEvent } = await import("@/lib/events/record");

const send = (body: unknown) =>
  POST(new Request("http://localhost/api/events", { method: "POST", body: JSON.stringify(body) }));

async function rows(name?: string) {
  const db = await database();
  const all = await db.select().from(t.events);
  return name ? all.filter((r) => r.name === name) : all;
}

beforeEach(async () => {
  cookies.clear();
  cookies.set("zg_visitor", "AAAAAAAAAAAAAAAAAAAAAA");
  requestHeaders = new Headers({ "user-agent": "Mozilla/5.0 (iPhone)" });
  const db = await database();
  await db.delete(t.events);
  resetEventCleanupForTests();
});

describe("POST /api/events and recordRequestEvent (#312, ADR 0025)", () => {
  it("stores an event on the list with the visitor's HMAC, the language and the identity, and nothing else", async () => {
    cookies.set("zg_lang", "en");
    const response = await send({ name: "job_view", path: "/jobs/[id]", jobId: "j3" });
    expect(response.status).toBe(204);
    const [row] = await rows("job_view");
    expect(row).toMatchObject({ path: "/jobs/[id]", jobId: "j3", lang: "en", role: "out", detail: null });
    expect(row.visitor).toMatch(/^[0-9a-f]{64}$/);
    expect(row.visitor).not.toContain("AAAA");
    expect(row.at).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
    expect(Object.keys(row).sort()).toEqual(
      ["at", "day", "detail", "id", "jobId", "lang", "name", "path", "role", "visitor"].sort(),
    );
  });

  it("joins one browser's steps in a day under one visitor", async () => {
    await send({ name: "home_view", path: "/" });
    await recordRequestEvent({ name: "apply_submit", path: "/jobs/[id]", jobId: "j3" });
    const [a, b] = await rows();
    expect(a.visitor).toBe(b.visitor);
  });

  it("answers 204 and stores nothing for what is not on the list, or is not JSON", async () => {
    expect((await send({ name: "page_view", path: "/" })).status).toBe(204);
    expect((await send({ name: "jobs_search", path: "/jobs", detail: "q=洗碗" })).status).toBe(204);
    await POST(new Request("http://localhost/api/events", { method: "POST", body: "not json" }));
    expect(await rows()).toHaveLength(0);
  });

  it("records nothing for crawlers and prefetches", async () => {
    requestHeaders = new Headers({ "user-agent": "Googlebot/2.1" });
    await send({ name: "home_view", path: "/" });
    requestHeaders = new Headers({ "next-router-prefetch": "1" });
    expect(await recordRequestEvent({ name: "home_view", path: "/" })).toBe("skipped");
    expect(await rows()).toHaveLength(0);
  });

  it(`keeps at most ${PER_DAY} of one kind from one visitor in a day`, async () => {
    for (let i = 0; i < PER_DAY + 3; i += 1) await recordRequestEvent({ name: "home_view", path: "/" });
    expect(await rows("home_view")).toHaveLength(PER_DAY);
    expect(await recordRequestEvent({ name: "jobs_list_view", path: "/jobs", detail: "all" })).toBe("recorded");
  });

  it("deletes events older than 180 days when the first event of a day comes in", async () => {
    const db = await database();
    const base = { visitor: "v", path: "/", lang: "zh" as const, role: "out" as const };
    await db.insert(t.events).values([
      { ...base, name: "home_view", at: "2026-01-01T00:00:00Z", day: "2026-01-01" },
      { ...base, name: "home_view", at: "2026-09-01T00:00:00Z", day: "2026-09-01" },
    ]);
    await recordRequestEvent({ name: "home_view", path: "/" }, new Date("2026-10-20T00:00:00Z"));
    const days = (await db.select({ day: t.events.day }).from(t.events).where(eq(t.events.visitor, "v"))).map(
      (r) => r.day,
    );
    expect(days).toEqual(["2026-09-01"]);
  });
});
