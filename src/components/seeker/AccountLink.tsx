"use client";

import Link from "next/link";
import { useHydrated, useSession } from "@/components/seeker/session-client";

/** "登录" or "我的" for the site header, depending on the demo sign-in. */
export function AccountLink({ className = "" }: { className?: string }) {
  const hydrated = useHydrated();
  const session = useSession();
  if (!hydrated) return <span className={`invisible ${className}`}>登录</span>;
  return session ? (
    <Link href="/me" className={className}>
      我的
    </Link>
  ) : (
    <Link href="/login" className={className}>
      登录
    </Link>
  );
}
