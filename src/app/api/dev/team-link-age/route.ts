import { getCurrentSession } from "@/lib/auth";
import { getAccountEmployer } from "@/lib/data";
import { devRepliesEnabled } from "@/lib/chat-server/dev";
import { ageTeamLink } from "@/db/team-links";

/**
 * Development and browser tests only (#349, ADR 0028): makes one of the signed-in employer's own invitation links
 * `days` days older, so an expired link can be tried without waiting a week. Body: { token, days } (1–365); the
 * token is the last part of the link. 404 in production.
 */
export async function POST(request: Request) {
  if (!devRepliesEnabled()) return new Response(null, { status: 404 });
  const session = await getCurrentSession();
  const employer = session && (await getAccountEmployer(session.email));
  if (!employer) return Response.json({ error: "需要雇主身份" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { token?: unknown; days?: unknown } | null;
  const days = typeof body?.days === "number" && Number.isInteger(body.days) ? body.days : NaN;
  if (Number.isNaN(days) || days < 1 || days > 365) return Response.json({ error: "天数不对" }, { status: 400 });
  const aged = typeof body?.token === "string" && (await ageTeamLink(employer.id, body.token, days));
  if (!aged) return Response.json({ error: "找不到这条链接" }, { status: 400 });
  return Response.json({ ok: true });
}
