"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { employerSignUpHref } from "@/components/seeker/identity";
import { setIdentity, useHydrated, useSession } from "@/components/seeker/session-client";

/** Who the employer pages act for. From the session, so for display and for telling the server who asks; the server decides. */
export interface EmployerIdentity {
  email: string;
  employerId: string;
  employerName: string;
}

const skeleton = <div className="h-40 animate-pulse rounded-xl border border-border bg-surface" aria-hidden="true" />;

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
      <p
        role="status"
        className="rounded-xl border border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-muted"
      >
        发布和管理招聘需要雇主身份，正在带你去开通……
        <Link href={signUp} className="ml-1 text-brand underline">
          没有跳转？点这里
        </Link>
      </p>
    );
  }
  if (seekerNow) {
    return (
      <div className="rounded-xl border border-border bg-surface px-4 py-6 text-center text-sm">
        <p>你现在用的是求职者身份。发布和管理招聘要用雇主身份。</p>
        <button
          type="button"
          disabled={switching}
          onClick={() => {
            setSwitching(true);
            setIdentity({ activeRole: "employer", employer: { id: me.employerId, name: me.employerName } });
          }}
          className="mt-3 rounded-lg bg-brand px-4 py-2 font-medium text-white disabled:opacity-40"
        >
          切换为雇主（{me.employerName}）
        </button>
      </div>
    );
  }
  return <>{children(me)}</>;
}
