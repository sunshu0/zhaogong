"use client";

import Link from "next/link";
import { useMessages, useSitePathname } from "@/i18n/client";
import { uiMessages } from "@/i18n/messages/ui";
import { MessageSquare } from "lucide-react";
import { UnreadBadge } from "@/components/seeker/ChatEntry";
import { useChat } from "@/components/seeker/chat-client";
import { useHydrated, useSession } from "@/components/seeker/session-client";
import { activeNavKey, headerItems, navRole, type NavWords } from "@/components/ui/nav";

/** The chat link's title, which tells screen readers and tests the unread count. */
export function chatTitle(unread: number, w: NavWords = uiMessages.zh.nav): string {
  return unread ? w.chatUnread(unread) : w.chat;
}

/**
 * Desktop header links by identity (from 768 px; phones use the bottom bar), centred in the header from 1024 px.
 * Only the current page is highlighted.
 * Like BottomNav, rendered in Suspense with HeaderNavShell (nothing highlighted) as the fallback.
 */
export function HeaderNav() {
  return <HeaderLinks pathname={useSitePathname()} />;
}

export function HeaderNavShell() {
  return <HeaderLinks pathname={null} />;
}

function HeaderLinks({ pathname }: { pathname: string | null }) {
  const hydrated = useHydrated();
  const session = useSession();
  const { totalUnread } = useChat();
  const w = useMessages(uiMessages).nav;
  const role = navRole(hydrated ? session : null);
  const active = pathname === null ? null : activeNavKey(pathname);
  return (
    <nav
      aria-label={w.main}
      className="hidden items-center gap-4 whitespace-nowrap text-body md:flex lg:absolute lg:left-1/2 lg:-translate-x-1/2 lg:gap-7"
    >
      {headerItems(role, w).map((item) => {
        const current = item.key === active;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={current ? "page" : undefined}
            title={item.key === "chat" ? chatTitle(totalUnread, w) : undefined}
            className={`inline-flex min-h-11 items-center gap-1.5 px-1 hover:text-brand ${
              current ? "font-semibold text-brand" : "text-muted"
            }`}
          >
            {item.key === "chat" && <MessageSquare aria-hidden="true" className="size-5" />}
            {item.label}
            {item.key === "chat" && <UnreadBadge count={totalUnread} />}
          </Link>
        );
      })}
    </nav>
  );
}
