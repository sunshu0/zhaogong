"use client";

// A staff account (ADR 0043: an admin or a moderator) is for moderating only. The server says which accounts are staff
// (login actions, withStaff); the browser's copy of the session carries it, and these keep everything else away.
import { useEffect, type ReactNode } from "react";
import { useHydrated, useSession } from "@/components/seeker/session-client";
import { ADMIN_PATH, staffMayOpen } from "@/components/ui/nav";
import { useSitePathname } from "@/i18n/client";

/** Whether the signed-in account is staff, as the server last said; false until the page has hydrated. */
export function useIsStaff(): boolean {
  const hydrated = useHydrated();
  const session = useSession();
  return hydrated && !!session?.staff;
}

/**
 * Sends a staff account from any page it has no use for (a job, 我的申请, 发布招聘…) to 审核后台, replacing the address
 * so 返回 does not lead back. Public pages and 我的 stay (staffMayOpen). In the layout, inside Suspense (the address).
 * A whole page load rather than router.replace: this runs as soon as its own boundary hydrates, and a client-side move
 * then would change the address under the boundaries still hydrating (the bottom bar drawn for the old page).
 */
export function StaffRedirect() {
  const pathname = useSitePathname();
  const away = useIsStaff() && !staffMayOpen(pathname);
  useEffect(() => {
    if (away) location.replace(ADMIN_PATH);
  }, [away]);
  return null;
}

/** What a staff account is not offered: the footer's links for job seekers and employers, say. */
export function NotForStaff({ children }: { children: ReactNode }) {
  return useIsStaff() ? null : children;
}
