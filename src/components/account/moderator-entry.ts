"use client";

import { useEffect, useState } from "react";
import { canModerate } from "@/app/[lang]/admin/entry-actions";
import { useSession } from "@/components/seeker/session-client";
import type { Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { accountMessages } from "@/i18n/messages/account";

/** The link to the moderation pages (#73), shown only where useCanModerate() says yes; adminEntry(lang) to name it. */
export const ADMIN_HREF = "/admin";

/** The same link named in the page's language: 审核后台 / Moderation. */
export function adminEntry(lang: Lang): { href: string; label: string } {
  return { href: ADMIN_HREF, label: pick(accountMessages, lang).rows.admin };
}

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
