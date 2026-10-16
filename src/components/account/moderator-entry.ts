"use client";

import { useEffect, useState } from "react";
import { canModerate } from "@/app/admin/entry-actions";
import { useSession } from "@/components/seeker/session-client";

/** The link to the moderation pages (#73), shown only where useCanModerate() says yes. */
export const ADMIN_ENTRY = { href: "/admin", label: "审核后台" } as const;

/**
 * Whether to show 审核后台 for the signed-in account: the server decides (canModerate), the browser only asks.
 * False until the answer for this account arrives, and for any other account. Asked when the component mounts and
 * again whenever `askAgain` changes: the header stays on screen across pages, so its menu asks each time it opens,
 * and someone made (or no longer) a moderator sees the change there.
 */
export function useCanModerate(askAgain?: unknown): boolean {
  const email = useSession()?.email;
  const [answer, setAnswer] = useState<{ email: string; ok: boolean } | null>(null);
  useEffect(() => {
    if (!email) return;
    let current = true;
    canModerate()
      .then((ok) => current && setAnswer({ email, ok }))
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [email, askAgain]);
  return !!email && answer?.email === email && answer.ok;
}
