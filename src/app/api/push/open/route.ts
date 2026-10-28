import { getCurrentSession } from "@/lib/auth";
import { findSharedConversation } from "@/db/conversations";
import { parseSharedId } from "@/lib/chat-server/shared-view";
import { isModerator } from "@/db/moderators";

/** Never changes role on GET. Stale notifications cannot open another identity's private chat. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const role = url.searchParams.get("role");
  const conversation = url.searchParams.get("conversation") ?? "";
  const session = await getCurrentSession();
  let destination = "/messages";
  if (!session) destination = "/login?next=" + encodeURIComponent(url.pathname + url.search);
  else if (
    (role !== "seeker" && role !== "employer") ||
    role !== session.activeRole ||
    (await isModerator(session.email))
  )
    destination = "/account?pushRole=" + (role === "employer" ? "employer" : "seeker");
  else {
    const key = parseSharedId(conversation, role);
    const reader =
      role === "seeker"
        ? { side: "seeker" as const, email: session.email }
        : session.employer
          ? { side: "employer" as const, employerId: session.employer.id }
          : null;
    if (key && reader && (await findSharedConversation(reader, key)))
      destination += `?conversation=${encodeURIComponent(conversation)}`;
  }
  return new Response(null, {
    status: 303,
    headers: { Location: new URL(destination, url.origin).href, "Cache-Control": "no-store" },
  });
}
