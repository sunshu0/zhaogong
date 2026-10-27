"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { markReturn, returnTo } from "@/components/seeker/list-place";
import { BACK } from "@/components/ui/PageTransition";

/**
 * An external job's 「← 返回实习」: back to its section's list. Opened from that list, back to the place in it the user
 * left, with its filters (#409, list-place.tsx), like the browser's back.
 */
export function SectionBackLink({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <Link
      href={href}
      transitionTypes={BACK}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        const list = returnTo(href);
        if (!list) return;
        e.preventDefault();
        markReturn();
        router.push(list, { transitionTypes: BACK, scroll: false });
      }}
      className={className}
    >
      {children}
    </Link>
  );
}
