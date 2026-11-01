"use client";

import type { ReactNode } from "react";
import { useSitePathname } from "@/i18n/client";
import { useSession } from "@/components/seeker/session-client";
import { identityScope } from "@/components/seeker/identity-scope";
import { WIDE_ON_DESKTOP } from "@/components/ui/wide";
import { MessageWorkspace } from "@/components/seeker/MessageWorkspace";
import { NotificationWorkspace } from "@/components/seeker/NotificationWorkspace";
import { ProfileWorkspace } from "@/components/seeker/ProfileWorkspace";
import { SignInGate } from "@/components/seeker/SignInGate";
import { WorkspaceDashboard } from "@/components/seeker/WorkspaceDashboard";
import { WorkspaceNav } from "@/components/seeker/WorkspaceNav";
import { workspaceTitle } from "@/components/seeker/workspace";
import { useLang, useMessages } from "@/i18n/client";
import { seekerMeMessages } from "@/i18n/messages/seeker-me";

/** Chat uses up to 96rem centred on the window instead of the usual wide column. */
const CHAT_WIDTH = "lg:ml-[calc(50%_-_min(48rem,_50vw_-_1.5rem))] lg:w-[min(96rem,_100vw_-_3rem)]";

/**
 * The 工作台 pages' frame: on desktop a side column with the workspace navigation. `look="app"` (Round 19) gives
 * the content the sample's type (`type-app`); each line passes it once its pages have the new cards.
 */
export function WorkHubFrame({ look, children }: { look?: "app"; children: ReactNode }) {
  const lang = useLang();
  const t = useMessages(seekerMeMessages).workspace;
  const pathname = useSitePathname();
  const session = useSession();
  const isEmployer = session?.activeRole === "employer";
  const width = pathname === "/messages" ? CHAT_WIDTH : WIDE_ON_DESKTOP;

  // ADR 0043: a staff account's 我的 is its role, 审核后台 and 退出登录 only, so no job seeker's or employer's side bar.
  if (session?.staff)
    return (
      <div className={width}>
        <div className={`min-w-0 ${look === "app" ? "type-app" : ""}`}>
          <div key={identityScope(session)}>{children}</div>
        </div>
      </div>
    );

  return (
    <div
      className={`${width} space-y-4 lg:grid lg:grid-cols-[10rem_minmax(0,1fr)] lg:items-start lg:gap-5 lg:space-y-0`}
    >
      <aside className="hidden lg:sticky lg:top-[4.5rem] lg:block">
        <div className="rounded-card bg-surface p-3 ring-1 ring-border">
          <div className="border-b border-border px-2 pb-3">
            <p className="text-meta font-medium text-brand">找工</p>
            <h2 className="mt-1 text-subtitle font-semibold">{t.title}</h2>
          </div>
          <WorkspaceNav pathname={pathname} isEmployer={isEmployer} />
          {session && (
            <p className="mt-3 border-t border-border px-2 pt-3 text-meta text-muted">
              {workspaceTitle(isEmployer, lang)}
            </p>
          )}
        </div>
      </aside>
      <div className={`min-w-0 space-y-4 lg:space-y-0 ${look === "app" ? "type-app" : ""}`}>
        <div key={identityScope(session)}>{children}</div>
      </div>
    </div>
  );
}

export function WorkspaceOverview() {
  const t = useMessages(seekerMeMessages).workspace;
  return (
    <SignInGate message={t.gateWorkspace}>
      <WorkspaceDashboard />
    </SignInGate>
  );
}

export function MessagesPage() {
  const t = useMessages(seekerMeMessages).workspace;
  return (
    <SignInGate message={t.gateChat}>
      <MessageWorkspace />
    </SignInGate>
  );
}

export function NotificationsPage() {
  const t = useMessages(seekerMeMessages).workspace;
  return (
    <SignInGate message={t.gateNotifications}>
      <NotificationWorkspace />
    </SignInGate>
  );
}

export function ProfilePage() {
  const t = useMessages(seekerMeMessages).workspace;
  return (
    <SignInGate message={t.gateProfile}>
      <ProfileWorkspace />
    </SignInGate>
  );
}
