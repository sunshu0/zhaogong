"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { accountStatus } from "@/app/[lang]/login/actions";
import { setIdentity, syncAccountIdentity, useSession } from "@/components/seeker/session-client";
import { useMessages } from "@/i18n/client";
import { accountMessages } from "@/i18n/messages/account";

/**
 * Switching between 求职者 and 雇主 (account menu and 我的). Both land on the workspace. `notice` explains when the
 * employer identity turned out to be gone.
 */
export function useIdentitySwitch() {
  const router = useRouter();
  const session = useSession();
  const t = useMessages(accountMessages).role;
  const [notice, setNotice] = useState<string | null>(null);
  const employer =
    session?.employerId && session.employerName ? { id: session.employerId, name: session.employerName } : null;

  async function toEmployer() {
    if (!session || !employer) return;
    setNotice(null);
    // Show the previously confirmed identity immediately, so navigating cannot cancel the user's choice.
    // The lookup still corrects revoked business access; all writes also check the account on the server.
    const requested = setIdentity({ activeRole: "employer", employer });
    router.push("/workspace");
    if (!requested) return;
    try {
      const status = await accountStatus(session.email);
      const current = syncAccountIdentity(requested, status ?? {});
      if (current?.email === requested.email && current.signedInAt === requested.signedInAt && !status?.employer) {
        setNotice(t.employerGone);
      }
    } catch {
      setNotice(t.checkFailed);
    }
  }

  function toSeeker() {
    if (!employer) return;
    setNotice(null);
    setIdentity({ activeRole: "seeker", employer });
    router.push("/workspace");
  }

  return { employer, toEmployer, toSeeker, notice, clearNotice: () => setNotice(null) };
}
