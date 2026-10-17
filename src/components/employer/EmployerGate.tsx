"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { employerSignUpHref } from "@/components/seeker/identity";
import { setIdentity, useHydrated, useSession } from "@/components/seeker/session-client";
import { Button } from "@/components/ui/Button";
import { SkeletonList } from "@/components/ui/Skeleton";
import { APP_CARD } from "@/components/employer/app-style";

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
      <p role="status" className={`${APP_CARD} py-6 text-center text-body text-muted`}>
        发布和管理招聘需要雇主身份，正在带你去开通……
        <Link href={signUp} className="ml-1 text-brand underline">
          没有跳转？点这里
        </Link>
      </p>
    );
  }
  if (seekerNow) {
    return (
      <div className={`${APP_CARD} py-6 text-center text-body`}>
        <p>你现在用的是求职者身份。发布和管理招聘要用雇主身份。</p>
        <Button
          loading={switching}
          onClick={() => {
            setSwitching(true);
            setIdentity({ activeRole: "employer", employer: { id: me.employerId, name: me.employerName } });
          }}
          className="mt-3"
        >
          切换为雇主（{me.employerName}）
        </Button>
      </div>
    );
  }
  return <>{children(me)}</>;
}
