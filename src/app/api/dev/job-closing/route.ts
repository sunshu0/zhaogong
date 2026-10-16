import { getCurrentSession } from "@/lib/auth";
import { getAccountEmployer, getJob, updateJob } from "@/lib/data";
import { devRepliesEnabled } from "@/lib/chat-server/dev";

const DAY_MS = 86_400_000;

/**
 * Development and browser tests only (#88): moves the closing date of one of the signed-in employer's own jobs to
 * `daysFromNow` days from now (negative: that long ago), so 将截止, 续期 and 重新发布 can be tried without waiting.
 * Through the server, so the write queues with the others instead of locking the database file from outside.
 * Body: { jobId, daysFromNow }. 404 in production.
 */
export async function POST(request: Request) {
  if (!devRepliesEnabled()) return new Response(null, { status: 404 });
  const session = await getCurrentSession();
  const employer = session && (await getAccountEmployer(session.email));
  if (!employer) return Response.json({ error: "需要雇主身份" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { jobId?: unknown; daysFromNow?: unknown } | null;
  const job = typeof body?.jobId === "string" ? await getJob(body.jobId) : undefined;
  const days = typeof body?.daysFromNow === "number" && Number.isFinite(body.daysFromNow) ? body.daysFromNow : NaN;
  if (!job || job.employerId !== employer.id) return Response.json({ error: "找不到这个职位" }, { status: 400 });
  if (Number.isNaN(days) || Math.abs(days) > 365) return Response.json({ error: "天数不对" }, { status: 400 });
  const expiresAt = new Date(Date.now() + days * DAY_MS).toISOString();
  return Response.json(await updateJob(job.id, { expiresAt }));
}
