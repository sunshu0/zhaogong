"use client";

import Link from "next/link";
import { UnreadBadge } from "@/components/seeker/ChatEntry";
import { useNotifications } from "@/components/seeker/hub-client";
import { ALERTS_PATH } from "@/components/seeker/job-alerts";
import { ACCOUNT_DATA_PATH } from "@/components/ui/nav";
import { useMessages } from "@/i18n/client";
import type { Messages } from "@/i18n/messages";
import { employerPhotosMessages } from "@/i18n/messages/employer-photos";
import { seekerMeMessages } from "@/i18n/messages/seeker-me";

type NavItem = { href: string; label: string };

/**
 * The workspace sidebar (from 1024 px). Names match the header, the account menu and 我的; 聊天 and 职位管理 are
 * in the header, so they are not repeated here. Phones reach these pages from 我的 in the bottom bar.
 */
function workspaceNav(isEmployer: boolean, t: WorkspaceWords, photos: string): NavItem[] {
  return [
    { href: "/workspace", label: t.overview },
    { href: "/notifications", label: t.notifications },
    { href: "/profile", label: isEmployer ? t.businessPage : t.profile },
    ...(isEmployer
      ? [
          { href: "/employer/candidates", label: t.candidates },
          { href: "/employer/photos", label: photos }, // ADR 0052: 门店照片和福利, beside the business page's other tools
          { href: "/employer/verify", label: t.verify }, // #78: from 工作台, not only from 企业主页
          { href: "/employer/team", label: t.team }, // #87
        ]
      : [
          { href: "/me/saved", label: t.saved },
          { href: ALERTS_PATH, label: t.alerts },
          { href: "/me", label: t.history },
        ]),
    // Both identities: on a desktop this sidebar and the account menu are the only ways to it (#76).
    { href: ACCOUNT_DATA_PATH, label: t.data },
  ];
}

type WorkspaceWords = Messages<(typeof seekerMeMessages)["zh"]>["workspace"];

// The current page: brand and semibold on the brand's soft colour (Round 19, like a chosen option).
const ACTIVE = "bg-brand-soft font-semibold text-brand";

export function WorkspaceNav({ pathname, isEmployer }: { pathname: string; isEmployer: boolean }) {
  const t = useMessages(seekerMeMessages).workspace;
  const photos = useMessages(employerPhotosMessages).page.title;
  const { unread: notificationUnread } = useNotifications();
  return (
    <nav aria-label={t.nav} className="mt-3 space-y-1">
      {workspaceNav(isEmployer, t, photos).map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`pressable-row flex min-h-11 items-center justify-between gap-2 rounded-control px-2.5 text-body ${
              active ? ACTIVE : "hover:bg-background"
            }`}
          >
            {item.label}
            {item.href === "/notifications" && <UnreadBadge count={notificationUnread} />}
          </Link>
        );
      })}
    </nav>
  );
}
