"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useSitePathname } from "@/i18n/client";
import { useHydrated, useSession } from "@/components/seeker/session-client";
import { buttonClass } from "@/components/ui/Button";
import { sheetClass } from "@/components/ui/Card";
import { useMessages } from "@/i18n/client";
import { uiMessages } from "@/i18n/messages/ui";

/**
 * Shows `children` to a signed-in user; anyone else gets `message` and a sign-in link back to this page, in a card
 * with a 48px main button (Round 19).
 */
export function SignInGate({ message, children }: { message: string; children: ReactNode }) {
  const t = useMessages(uiMessages);
  const pathname = useSitePathname();
  const hydrated = useHydrated();
  const session = useSession();
  if (hydrated && session) return children;
  return (
    <div className={`${sheetClass({ padded: false })} px-6 py-12 text-center`}>
      <p className="text-subtitle font-medium">{message}</p>
      <Link
        href={`/login?next=${encodeURIComponent(pathname)}`}
        className={`${buttonClass("primary", { size: "lg" })} mt-5 px-8`}
      >
        {t.signIn}
      </Link>
    </div>
  );
}
