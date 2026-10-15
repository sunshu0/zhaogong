"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useHydrated, useSession } from "@/components/seeker/session-client";

/** Shows `children` to a signed-in user; anyone else gets `message` and a sign-in link back to this page. */
export function SignInGate({ message, children }: { message: string; children: ReactNode }) {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const session = useSession();
  if (hydrated && session) return children;
  return (
    <div className="rounded-md border border-border bg-surface px-4 py-12 text-center">
      <p className="font-medium">{message}</p>
      <Link
        href={`/login?next=${encodeURIComponent(pathname)}`}
        className="mt-4 inline-block rounded-md bg-brand px-4 py-2 text-sm font-medium text-white"
      >
        登录 / 注册
      </Link>
    </div>
  );
}
