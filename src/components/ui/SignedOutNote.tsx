"use client";

import { useSession } from "@/components/seeker/session-client";

/**
 * A sentence for visitors who are not signed in: why they cannot sign in here (lib/auth/notice.ts), said before they
 * press anything that needs it. Gone once the browser has a session.
 */
export function SignedOutNote({ text, className }: { text: string; className?: string }) {
  const session = useSession();
  if (session) return null;
  return (
    <p role="note" data-sign-in-notice="" className={className}>
      {text}
    </p>
  );
}
