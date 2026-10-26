import { requireModerator } from "@/app/[lang]/admin/moderator";
import { database } from "@/db/ready";
import * as t from "@/db/schema";
import { devRepliesEnabled } from "@/lib/chat-server/dev";
import { and, eq, isNotNull } from "drizzle-orm";

const MINUTE_MS = 60_000;

/**
 * Development and browser tests only (ADR 0044): moves the end of a business's temporary ban to `minutesFromNow`
 * minutes from now (negative: that long ago), so a test sees a ban run out without waiting days. Only a moderator
 * signed in, and only a temporary ban (a permanent one has no end to move). Through the server, so the write queues
 * with the others. Body: { employerId, minutesFromNow }. 404 in production.
 */
export async function POST(request: Request) {
  if (!devRepliesEnabled()) return new Response(null, { status: 404 });
  const me = await requireModerator();
  if (!me.ok) return Response.json({ error: "需要审核员" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { employerId?: unknown; minutesFromNow?: unknown } | null;
  const id = typeof body?.employerId === "string" ? body.employerId : "";
  const minutes =
    typeof body?.minutesFromNow === "number" && Number.isFinite(body.minutesFromNow) ? body.minutesFromNow : NaN;
  if (!id || Number.isNaN(minutes) || Math.abs(minutes) > 60 * 24 * 60) {
    return Response.json({ error: "参数不对" }, { status: 400 });
  }
  const db = await database();
  const rows = await db
    .update(t.employers)
    .set({ bannedUntil: new Date(Date.now() + minutes * MINUTE_MS).toISOString() })
    .where(and(eq(t.employers.id, id), isNotNull(t.employers.bannedUntil)))
    .returning({ id: t.employers.id, bannedUntil: t.employers.bannedUntil });
  if (!rows.length) return Response.json({ error: "这家企业没有暂时封禁" }, { status: 400 });
  return Response.json(rows[0]);
}
