"use client";

import { Search } from "lucide-react";
import { useMessages, useSitePathname } from "@/i18n/client";
import { useHydrated, useSession } from "@/components/seeker/session-client";
import { navRole } from "@/components/ui/nav";
import { seekerJobsMessages } from "@/i18n/messages/seeker-jobs";

/**
 * The desktop header's job search (V6, #376), from 1280 px: a plain GET form to the job list, so it works before
 * the page's script. The home page and the job list have a search box of their own, so it stays away there; so
 * does it for employers, whose header is full with their own links.
 */
export function HeaderSearch() {
  const pathname = useSitePathname();
  const f = useMessages(seekerJobsMessages).filter;
  const hydrated = useHydrated();
  const session = useSession();
  if (pathname === "/" || pathname === "/jobs" || navRole(hydrated ? session : null) === "employer") return null;
  return (
    <form action="/jobs" role="search" className="relative hidden xl:block">
      <Search aria-hidden="true" className="pointer-events-none absolute top-3 left-3.5 size-4 text-muted" />
      <input
        type="search"
        name="q"
        maxLength={50}
        enterKeyHint="search"
        placeholder={f.searchPlaceholder}
        aria-label={f.search}
        className="h-10 w-64 rounded-full bg-neutral-soft pr-3.5 pl-9 text-body outline-none placeholder:text-muted focus:ring-2 focus:ring-brand/40"
      />
    </form>
  );
}
