"use server";

// 我的举报 (S2, ADR 0041): which of this browser's reports are still open. Open reports carry a keyed hash of who
// sent them (ADR 0034), cleared when a moderator closes them; this answers with the ids of the open ones the
// request's account or visitor id sent, and nothing else. It never takes an id to look up: report ids are sequential.
import { cookies } from "next/headers";
import { getCurrentSession } from "@/lib/auth";
import { openReportIds } from "@/lib/data";
import { reporterKey } from "@/lib/report-limits";
import { VISITOR_COOKIE, isVisitorId } from "@/lib/visitor";

/**
 * The ids of the open reports this browser sent: as its account when signed in, and as its visitor id either way,
 * since reports sent before signing in carry the visitor's hash and move to the account's list on this device.
 */
export async function myOpenReports(): Promise<string[]> {
  const session = await getCurrentSession();
  const visitor = (await cookies()).get(VISITOR_COOKIE)?.value;
  const keys = [
    session ? reporterKey({ account: session.email }) : undefined,
    isVisitorId(visitor) ? reporterKey({ visitor }) : undefined,
  ].filter((key): key is string => !!key);
  return openReportIds(keys);
}
