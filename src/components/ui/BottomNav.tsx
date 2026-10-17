"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, ClipboardList, MessageSquare, Plus, UserRound, type LucideIcon } from "lucide-react";
import { UnreadBadge } from "@/components/seeker/ChatEntry";
import { useChat } from "@/components/seeker/chat-client";
import { useHydrated, useSession } from "@/components/seeker/session-client";
import { chatTitle } from "@/components/ui/HeaderNav";
import { activeBottomKey, bottomNavItems, hidesBottomNav, navRole, type NavKey } from "@/components/ui/nav";

const ICONS: Partial<Record<NavKey, LucideIcon>> = {
  jobs: Briefcase,
  manage: ClipboardList,
  chat: MessageSquare,
  mine: UserRound,
};

/**
 * The phone's bottom bar (below 768 px), by identity. Pages leave room for it through --bottom-nav-space
 * (globals.css); bars that stick to the bottom of a page sit above it with `bottom-above-nav`.
 * The page address is only known at request time on dynamic routes, so the layout renders it in Suspense with
 * BottomNavShell as the fallback (also what a browser without JavaScript keeps there).
 */
export function BottomNav() {
  return <BottomNavBar pathname={usePathname()} />;
}

/** The signed-out bar with nothing highlighted, for before the address is known. */
export function BottomNavShell() {
  return <BottomNavBar pathname={null} />;
}

function BottomNavBar({ pathname }: { pathname: string | null }) {
  const hydrated = useHydrated();
  const session = useSession();
  const { totalUnread } = useChat();
  if (pathname !== null && hidesBottomNav(pathname)) return null;
  const role = navRole(hydrated ? session : null);
  const active = pathname === null ? null : activeBottomKey(pathname);
  return (
    <nav
      id="bottom-nav"
      aria-label="底部导航"
      className="fixed inset-x-0 bottom-0 z-20 [view-transition-name:bottom-nav] border-t border-border/70 bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md backdrop-saturate-150 md:hidden"
    >
      <ul className="flex h-14">
        {bottomNavItems(role).map((item) => {
          const current = item.key === active;
          if (item.key === "post") {
            return (
              <li key={item.key} className="flex flex-1 justify-center">
                <Link
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  className="pressable -mt-4 flex flex-col items-center gap-0.5 text-meta font-medium text-brand"
                >
                  <span className="flex size-11 items-center justify-center rounded-full bg-brand text-white ring-4 ring-surface">
                    <Plus aria-hidden="true" className="size-6" />
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          }
          const Icon = ICONS[item.key] ?? Briefcase;
          const unread = item.key === "chat" && role !== "out" ? totalUnread : 0;
          return (
            <li key={item.key} className="flex-1">
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                title={item.key === "chat" && role !== "out" ? chatTitle(unread) : undefined}
                className={`pressable flex h-full flex-col items-center justify-center gap-0.5 text-meta ${
                  current ? "font-semibold text-brand" : "text-muted"
                }`}
              >
                <span className="relative">
                  {/* Round 19: the current item's icon turns solid and grows a little. */}
                  <Icon
                    aria-hidden="true"
                    className={`size-6 transition-transform duration-(--duration-ui) ease-(--ease-app) ${current ? "scale-110" : ""}`}
                    strokeWidth={current ? 2 : 1.75}
                    fill={current ? "currentColor" : "none"}
                  />
                  {unread > 0 && (
                    <span className="absolute -top-1.5 left-4">
                      <UnreadBadge count={unread} />
                    </span>
                  )}
                </span>
                {item.label}
                {/* The current item: a short 3px line under its name (always there, so the labels stay level). */}
                <span aria-hidden="true" className={`h-[3px] w-4 rounded-full ${current ? "bg-brand" : ""}`} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
