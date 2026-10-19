// The visitor column of an event (#312, ADR 0025 §3): an HMAC of the zg_visitor cookie and the New Zealand day, keyed
// by ZG_EVENTS_SECRET. The same browser joins up within a day and not across days, and without the key the database
// and someone's cookie together still do not match. Server only.
import { createHmac } from "node:crypto";
import { isProduction } from "@/lib/auth/config";
import { isTestBuild } from "@/lib/test-build";

/** For development, unit tests and the test build, where there is no real key. Never used in production. */
export const TEST_EVENTS_SECRET = "zhaogong-events-test-only";

let warned = false;

/**
 * The key for the visitor column, or null when events must not be recorded: a production server (not the test
 * build) without ZG_EVENTS_SECRET. It says so in the server log once.
 */
export function eventsSecret(env: Record<string, string | undefined> = process.env): string | null {
  const secret = env.ZG_EVENTS_SECRET;
  if (secret) return secret;
  if (isProduction() && !isTestBuild()) {
    if (!warned) console.warn("ZG_EVENTS_SECRET is not set: no click analytics events are recorded (ADR 0025).");
    warned = true;
    return null;
  }
  return TEST_EVENTS_SECRET;
}

/** HMAC-SHA256 of the visitor id and the day, hex. */
export function visitorKey(visitorId: string, day: string, secret: string): string {
  return createHmac("sha256", secret).update(`${visitorId}|${day}`).digest("hex");
}
