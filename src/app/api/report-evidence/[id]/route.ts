// GET /api/report-evidence/[id] (ADR 0027 §2-3): one screenshot a job report carries, for a moderator only. Each
// time it is handed over, recordViews notes which moderator saw which report's evidence (ADR 0026) first. The answer
// is the image and nothing a browser could run: its own type, nosniff, a sandbox, never cached. Anyone else, or an id
// that is not a screenshot, gets 404.
import { requireModerator } from "@/app/[lang]/admin/moderator";
import { evidenceStore } from "@/db/evidence-store";
import { recordViews } from "@/db/personal-info-views";
import { findEvidenceImage } from "@/db/report-evidence";

const notFound = () => new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(_request: Request, { params }: RouteContext<"/api/report-evidence/[id]">) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return notFound();
  const moderator = await requireModerator().catch(() => undefined);
  if (!moderator?.ok) return notFound();
  const image = await findEvidenceImage(id);
  if (!image) return notFound();
  const bytes = await evidenceStore().get(image.key);
  if (!bytes) return notFound();
  await recordViews(moderator.email, "chat", [image.reportId]);
  return new Response(bytes, {
    headers: {
      "Content-Type": image.type,
      "Content-Length": String(bytes.length),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
    },
  });
}
