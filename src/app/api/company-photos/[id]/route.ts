// GET /api/company-photos/[id] (ADR 0052 §2): one shop photo of a 企业主页. Approved, of a business that is not
// banned: anyone, cached by the browser for PHOTO_CACHE_SECONDS (a photo taken down stops showing within that).
// Waiting for review: only the business's own team and moderators, never cached. Anything else, or an id that is not
// a photo id, is 404. The answer is the image and nothing a browser could run: the type judged from its bytes at
// upload, nosniff, a sandbox.
import { requireModerator } from "@/app/[lang]/admin/moderator";
import { getCurrentSession } from "@/lib/auth";
import { getAccountEmployer } from "@/lib/data";
import { findServablePhoto } from "@/db/employer-photos";
import { photoStore } from "@/db/photo-store";
import { PHOTO_CACHE_SECONDS, PHOTO_ID } from "@/lib/company-photos";

const notFound = () => new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });

/** Whoever asks is in the photo's business, or a moderator (for a photo waiting for review). */
async function mayReview(employerId: string): Promise<boolean> {
  const session = await getCurrentSession();
  if (!session) return false;
  if ((await getAccountEmployer(session.email))?.id === employerId) return true;
  const moderator = await requireModerator().catch(() => undefined);
  return Boolean(moderator?.ok);
}

export async function GET(_request: Request, { params }: RouteContext<"/api/company-photos/[id]">) {
  const id = (await params).id;
  if (!PHOTO_ID.test(id)) return notFound();
  const photo = await findServablePhoto(id);
  if (!photo || photo.employerBanned) return notFound();
  const open = photo.status === "approved";
  if (!open && !(await mayReview(photo.employerId))) return notFound();
  const bytes = await photoStore().get(id);
  if (!bytes) return notFound();
  return new Response(bytes, {
    headers: {
      "Content-Type": photo.type,
      "Content-Length": String(bytes.length),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Disposition": "inline",
      "Cache-Control": open ? `public, max-age=${PHOTO_CACHE_SECONDS}` : "private, no-store",
    },
  });
}
