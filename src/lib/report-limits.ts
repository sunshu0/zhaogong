// How often a job may be reported (security review C, ADR 0034): one open report per person and job, and a daily
// count per person. A person is the signed-in account, else the browser's visitor id (zg_visitor); the IP from
// Cloudflare counts too for a report without an account, since a new visitor id is one cleared cookie away. Counts go
// in auth_limits with ADR 0033's one-statement upsert, under a keyed hash, and go when their 24 hours end. Server only.
import { createHmac } from "node:crypto";
import { authSecret } from "@/lib/auth/config";
import { authStore } from "@/lib/auth/store";
import { normalizeEmail } from "@/components/seeker/session";

const DAY = 24 * 3600_000;

/** The daily counts and their numbers; why these: ADR 0034. */
export const REPORT_LIMITS = {
  /** Reports from one signed-in account. */
  account: 10,
  /** Screenshots attached by one account (only signed-in reports carry them): 20 at up to 5 MB, 100 MB a day. */
  images: 20,
  /** Reports without an account from one browser (its visitor id). */
  visitor: 5,
  /** Reports without an account from one network address, whatever the visitor id. */
  ip: 20,
  /** Reports from browsers with neither a visitor id nor an address (cookies refused, no Cloudflare): one shared count. */
  unknown: 20,
} as const;

export type ReportLimit = keyof typeof REPORT_LIMITS;

/** Who is reporting: the account, else the visitor id; undefined for a browser with neither. */
export type Reporter = { account: string } | { visitor: string } | undefined;

/**
 * A keyed hash with its purpose in front ("report:…"), so a report's hash never equals the sign-in limits' or any
 * other use of the same id under AUTH_SECRET, and they cannot be matched up.
 */
function hash(input: string): string {
  return createHmac("sha256", authSecret()).update(input).digest("hex");
}

/**
 * The reports.reporter value: a keyed hash, so the table holds no email or visitor id in the clear. An account is
 * its email, which is the account's key (accounts.email) and cannot be changed.
 */
export function reporterKey(reporter: Reporter): string | undefined {
  if (!reporter) return undefined;
  return "account" in reporter
    ? hash(`report:acct:${normalizeEmail(reporter.account)}`)
    : hash(`report:visitor:${reporter.visitor}`);
}

/** The counts one report takes: `[limit, subject, how many]`. */
export function reportCounts(reporter: Reporter, ip: string | undefined, images: number) {
  const counts: [ReportLimit, string, number][] = [];
  if (reporter && "account" in reporter) {
    const account = normalizeEmail(reporter.account);
    counts.push(["account", account, 1]);
    if (images) counts.push(["images", account, images]);
    return counts;
  }
  if (reporter) counts.push(["visitor", reporter.visitor, 1]);
  if (ip) counts.push(["ip", ip, 1]);
  if (!reporter && !ip) counts.push(["unknown", "", 1]);
  return counts;
}

/**
 * Takes the report's counts, each in one statement (ADR 0033's takeLimit); the first one that is full, or undefined
 * when all were taken. Counts taken before a full one stay taken: they are a day's ceiling, not a ledger.
 */
export async function takeReportCounts(
  reporter: Reporter,
  ip: string | undefined,
  images: number,
  now = new Date(),
): Promise<ReportLimit | undefined> {
  const store = authStore();
  await store.clearEndedLimits(now.toISOString());
  const start = Math.floor(now.getTime() / DAY) * DAY;
  const expiresAt = new Date(start + DAY).toISOString();
  for (const [limit, subject, times] of reportCounts(reporter, ip, images)) {
    const key = hash(`report:limit:${limit}:${subject}:${start}`);
    for (let i = 0; i < times; i++) {
      if (!(await store.takeLimit(key, REPORT_LIMITS[limit], expiresAt))) return limit;
    }
  }
  return undefined;
}
