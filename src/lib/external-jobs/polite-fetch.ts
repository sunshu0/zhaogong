// Reading the public APIs politely (#111, ADR 0014): the host's robots.txt is read first and obeyed, requests to one
// host are spaced out (at least `minIntervalMs`, or the host's Crawl-delay if longer), one at a time, and every
// request says who we are. The clock, the wait and fetch are passed in, so tests never touch the network.

export const USER_AGENT = "zhaogong-external-jobs/1.0 (+https://github.com/open-alternative-app/zhaogong)";
const AGENT_TOKEN = "zhaogong-external-jobs";

interface RobotsGroup {
  agents: string[];
  rules: { allow: boolean; path: string }[];
  crawlDelay?: number;
}

export interface Robots {
  allowed(path: string): boolean;
  /** Seconds between requests the host asks for, if any. */
  crawlDelay?: number;
}

/**
 * robots.txt as the Robots Exclusion Protocol (RFC 9309) reads it: the group for our agent token, else the `*`
 * group; the longest matching rule wins and Allow wins a tie; `*` and `$` in paths are understood.
 */
export function parseRobots(text: string): Robots {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | undefined;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === "allow" || key === "disallow") {
      if (value) current.rules.push({ allow: key === "allow", path: value });
    } else if (key === "crawl-delay") {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) current.crawlDelay = n;
    }
  }
  const group =
    groups.find((g) => g.agents.some((a) => a !== "*" && AGENT_TOKEN.startsWith(a))) ??
    groups.find((g) => g.agents.includes("*"));
  const rules = group?.rules ?? [];
  const matches = (rule: string, path: string) => {
    const anchored = rule.endsWith("$");
    const body = (anchored ? rule.slice(0, -1) : rule).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp(`^${body}${anchored ? "$" : ""}`).test(path);
  };
  return {
    crawlDelay: group?.crawlDelay,
    allowed(path) {
      let best: { allow: boolean; path: string } | undefined;
      for (const rule of rules) {
        if (!matches(rule.path, path)) continue;
        if (!best || rule.path.length > best.path.length || (rule.path.length === best.path.length && rule.allow)) {
          best = rule;
        }
      }
      return best ? best.allow : true;
    },
  };
}

export class RobotsDisallowed extends Error {
  constructor(url: string) {
    super(`robots.txt does not allow ${url}`);
    this.name = "RobotsDisallowed";
  }
}

export interface PoliteFetchOptions {
  fetch: typeof fetch;
  minIntervalMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
}

/** A JSON getter that reads robots.txt once per host, obeys it and spaces out requests to each host. */
export function politeFetcher({
  fetch: get,
  minIntervalMs = 2000,
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  timeoutMs = 30_000,
}: PoliteFetchOptions) {
  const robots = new Map<string, Robots>();
  const last = new Map<string, number>();

  async function request(url: URL, accept: string): Promise<Response> {
    const host = url.host;
    const gap = Math.max(minIntervalMs, (robots.get(host)?.crawlDelay ?? 0) * 1000);
    const previous = last.get(host);
    if (previous != null && now() - previous < gap) await sleep(gap - (now() - previous));
    last.set(host, now());
    return get(url, {
      headers: { "User-Agent": USER_AGENT, Accept: accept },
      signal: AbortSignal.timeout(timeoutMs),
    });
  }

  async function robotsFor(url: URL): Promise<Robots> {
    const known = robots.get(url.host);
    if (known) return known;
    const res = await request(new URL("/robots.txt", url), "text/plain");
    // No robots.txt (4xx) allows everything; a server error means we cannot tell, so we stay away (RFC 9309 2.3.1).
    if (res.status >= 500) throw new Error(`robots.txt of ${url.host} answered ${res.status}`);
    const parsed = res.ok ? parseRobots(await res.text()) : parseRobots("");
    robots.set(url.host, parsed);
    return parsed;
  }

  return async function getJson(href: string): Promise<unknown> {
    const url = new URL(href);
    const rules = await robotsFor(url);
    if (!rules.allowed(url.pathname + url.search)) throw new RobotsDisallowed(href);
    const res = await request(url, "application/json");
    if (!res.ok) throw new Error(`${href} answered ${res.status}`);
    return res.json();
  };
}
