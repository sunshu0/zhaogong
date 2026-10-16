import { describe, expect, it } from "vitest";
import { parseRobots, politeFetcher, RobotsDisallowed, USER_AGENT } from "@/lib/external-jobs/polite-fetch";

describe("polite fetching of the public APIs (#111)", () => {
  it("reads robots.txt: the group for us or *, the longest rule wins, Allow wins a tie", () => {
    const greenhouse = parseRobots("User-agent: *\nDisallow: /embed/\n");
    expect(greenhouse.allowed("/v1/boards/acme/jobs?content=true")).toBe(true);
    expect(greenhouse.allowed("/embed/job_board")).toBe(false);

    const lever = parseRobots("User-agent: *\nAllow: /\nCrawl-delay: 1\n");
    expect(lever.allowed("/v0/postings/acme")).toBe(true);
    expect(lever.crawlDelay).toBe(1);

    const ours = parseRobots(
      "User-agent: *\nDisallow: /\n\nUser-agent: zhaogong-external-jobs\nDisallow: /private\nAllow: /private/ok$\n",
    );
    expect(ours.allowed("/v1/boards")).toBe(true);
    expect(ours.allowed("/private/x")).toBe(false);
    expect(ours.allowed("/private/ok")).toBe(true);
    expect(ours.allowed("/private/ok/more")).toBe(false);

    expect(parseRobots("User-agent: *\nDisallow: /*.json$").allowed("/a/b.json")).toBe(false);
    expect(parseRobots("").allowed("/anything")).toBe(true);
  });

  function fakeHost(robots: string | number, body: unknown = { jobs: [] }) {
    const calls: { url: string; at: number; agent: string | null }[] = [];
    let clock = 0;
    const fetch = (async (input: URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, at: clock, agent: new Headers(init?.headers).get("User-Agent") });
      if (url.endsWith("/robots.txt")) {
        return typeof robots === "number" ? new Response("", { status: robots }) : new Response(robots);
      }
      return Response.json(body);
    }) as unknown as typeof globalThis.fetch;
    const getJson = politeFetcher({
      fetch,
      minIntervalMs: 2000,
      now: () => clock,
      sleep: async (ms) => {
        clock += ms;
      },
    });
    return { calls, getJson };
  }

  it("reads robots.txt once per host, names itself, and spaces requests to a host", async () => {
    const { calls, getJson } = fakeHost("User-agent: *\nCrawl-delay: 5\n");
    expect(await getJson("https://api.example.com/v0/postings/a")).toEqual({ jobs: [] });
    await getJson("https://api.example.com/v0/postings/b");
    expect(calls.map((c) => [c.url, c.at])).toEqual([
      ["https://api.example.com/robots.txt", 0],
      ["https://api.example.com/v0/postings/a", 5000],
      ["https://api.example.com/v0/postings/b", 10000],
    ]);
    expect(calls.every((c) => c.agent === USER_AGENT)).toBe(true);
  });

  it("does not request what robots.txt disallows, and stays away when robots.txt fails", async () => {
    const closed = fakeHost("User-agent: *\nDisallow: /v1/\n");
    await expect(closed.getJson("https://boards.example.com/v1/boards/a/jobs")).rejects.toBeInstanceOf(
      RobotsDisallowed,
    );
    expect(closed.calls.map((c) => c.url)).toEqual(["https://boards.example.com/robots.txt"]);

    const broken = fakeHost(503);
    await expect(broken.getJson("https://boards.example.com/v1/boards/a/jobs")).rejects.toThrow(/503/);
    expect(broken.calls).toHaveLength(1);

    const none = fakeHost(404);
    expect(await none.getJson("https://boards.example.com/v1/boards/a/jobs")).toEqual({ jobs: [] });

    // api.ashbyhq.com answers 401 for robots.txt (#138): a 4xx means there is none (RFC 9309 2.3.1.3).
    const locked = fakeHost(401);
    expect(await locked.getJson("https://api.example.com/posting-api/job-board/a")).toEqual({ jobs: [] });
  });
});
