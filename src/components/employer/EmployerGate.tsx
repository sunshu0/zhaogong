"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { employerSignUpHref } from "@/components/seeker/identity";
import { setIdentity, useHydrated, useSession } from "@/components/seeker/session-client";
import { Button } from "@/components/ui/Button";
import { SkeletonList } from "@/components/ui/Skeleton";
import { APP_SHEET } from "@/components/employer/app-style";
import { useMessages } from "@/i18n/client";
import { employerCommonMessages } from "@/i18n/messages/employer-common";

/** Who the employer pages act for. From the session, so for display and for telling the server who asks; the server decides. */
export interface EmployerIdentity {
  email: string;
  employerId: string;
  employerName: string;
}

const skeleton = <SkeletonList count={2} />;

/**
 * Posting and managing jobs need the employer identity first. Without one, sends the visitor to line A's
 * employer sign-up step and back to `next`. An account with a business but in its job-seeker identity is
 * asked to switch (never switched behind its back: that would undo 切换为求职者 from the account menu).
 * Every Server Function behind these pages checks the account again.
 */
export function EmployerGate({ next, children }: { next: string; children: (me: EmployerIdentity) => ReactNode }) {
  const t = useMessages(employerCommonMessages).gate;
  const hydrated = useHydrated();
  const session = useSession();
  const router = useRouter();
  const me: EmployerIdentity | undefined =
    session?.employerId && session.employerName
      ? { email: session.email, employerId: session.employerId, employerName: session.employerName }
      : undefined;
  const signUp = employerSignUpHref(next);
  const missing = hydrated && !me;
  const seekerNow = !!me && session?.activeRole !== "employer";
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (missing) router.replace(signUp);
  }, [missing, signUp, router]);

  if (!hydrated) return skeleton;
  if (!me) {
    return (
      <p role="status" className={`${APP_SHEET} py-6 text-center text-body text-muted`}>
        {t.needsEmployer}
        <Link href={signUp} className="ml-1 text-brand underline">
          {t.noRedirect}
        </Link>
      </p>
    );
  }
  if (seekerNow) {
    return (
      <div className={`${APP_SHEET} py-6 text-center text-body`}>
        <p>{t.seekerNow}</p>
        <Button
          loading={switching}
          onClick={() => {
            setSwitching(true);
            setIdentity({ activeRole: "employer", employer: { id: me.employerId, name: me.employerName } });
          }}
          className="mt-3"
        >
          {t.switchToEmployer(me.employerName)}
        </Button>
      </div>
    );
  }
  return <>{children(me)}</>;
}
