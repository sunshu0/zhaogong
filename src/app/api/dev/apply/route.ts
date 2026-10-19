// POST /api/dev/apply: development and browser tests only (404 in production). The job pages have no 申请 since the
// user took it off (10-20 11:0x), but line B's 申请人 list, interviews and 已录用 still read applications until they
// move to the job's chats; their browser tests make an application here, as the signed-in job seeker, with the page
// the account would have sent. Body: { jobId, note? }. Answers applyForJob's result.
import { getCurrentSession } from "@/lib/auth";
import { applyForJob } from "@/lib/applications-server";
import { initialProfile } from "@/components/seeker/hub-state";
import { devHelpersEnabled } from "@/lib/test-build";

export async function POST(request: Request) {
  if (!devHelpersEnabled()) return new Response(null, { status: 404 });
  const session = await getCurrentSession();
  if (!session) return Response.json({ error: "请先登录" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { jobId?: unknown; note?: unknown } | null;
  const jobId = typeof body?.jobId === "string" ? body.jobId : "";
  const page = initialProfile({ email: session.email, signedInAt: "", activeRole: "seeker" });
  return Response.json(await applyForJob(jobId, body?.note ?? "", page));
}
