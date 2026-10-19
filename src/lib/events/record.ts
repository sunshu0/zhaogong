// Records a funnel event for the request being answered (#312, ADR 0025 §4): from /api/events (the browser's
// track()) and from Server Functions after they succeed (signInAccount, applyForJob, publishJob…). Takes the
// visitor, language and identity from the request; a crawler or a prefetch records nothing, nor does a production
// server without ZG_EVENTS_SECRET. Never throws: an event that cannot be stored must not break what was being done.
// Server only.
import { cookies, headers } from "next/headers";
import { recordEvent } from "@/db/events";
import { nzDay } from "@/db/job-stats";
import { requestLang } from "@/i18n/server";
import { getCurrentSession } from "@/lib/auth";
import { checkEvent, type EventInput } from "@/lib/events/catalog";
import { isBotOrPrefetch } from "@/lib/events/request";
import { eventsSecret, visitorKey } from "@/lib/events/visitor-key";
import { VISITOR_COOKIE, isVisitorId, newVisitorId } from "@/lib/visitor";

export type RecordResult = "recorded" | "capped" | "invalid" | "skipped";

/**
 * Stores `input` if it is on the list (catalog.ts). A browser without the visitor cookie (cookies refused) counts
 * under a throw-away id, so its steps do not join up; the proxy hands the cookie out with every page.
 */
export async function recordRequestEvent(input: EventInput | unknown, now = new Date()): Promise<RecordResult> {
  try {
    const event = checkEvent(input);
    if (!event) return "invalid";
    if (isBotOrPrefetch(await headers())) return "skipped";
    const secret = eventsSecret();
    if (!secret) return "skipped";
    const sent = (await cookies()).get(VISITOR_COOKIE)?.value;
    const visitor = visitorKey(isVisitorId(sent) ? sent : newVisitorId(), nzDay(now), secret);
    const session = await getCurrentSession();
    const role = !session ? "out" : session.activeRole === "employer" ? "employer" : "seeker";
    return await recordEvent({ ...event, visitor, lang: await requestLang(), role }, now);
  } catch (error) {
    console.error("click analytics: an event was not stored", error);
    return "skipped";
  }
}
