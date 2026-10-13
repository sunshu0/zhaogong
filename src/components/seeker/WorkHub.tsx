"use client";

import type { ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
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

/** Chat uses up to 96rem centred on the window instead of the usual wide column. */
const CHAT_WIDTH = "lg:ml-[calc(50%_-_min(48rem,_50vw_-_1.5rem))] lg:w-[min(96rem,_100vw_-_3rem)]";

export function WorkHubFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const session = useSession();
  const isEmployer = session?.activeRole === "employer";
  const width = pathname === "/messages" ? CHAT_WIDTH : WIDE_ON_DESKTOP;

  return (
    <div
      className={`${width} space-y-4 lg:grid lg:grid-cols-[10rem_minmax(0,1fr)] lg:items-start lg:gap-5 lg:space-y-0`}
    >
      <aside className="hidden lg:sticky lg:top-[4.5rem] lg:block">
        <div className="border-r border-border pr-4 py-3">
          <div className="border-b border-border px-2 pb-3">
            <p className="text-xs font-medium text-brand">找工</p>
            <h2 className="mt-1 text-lg font-semibold">工作台</h2>
          </div>
          <WorkspaceNav layout="sidebar" pathname={pathname} isEmployer={isEmployer} />
          {session && (
            <p className="mt-3 border-t border-border px-2 pt-3 text-xs text-muted">{workspaceTitle(isEmployer)}</p>
          )}
        </div>
      </aside>
      <div className="min-w-0 space-y-4 lg:space-y-0">
        <div className="-mx-4 overflow-x-auto border-b border-border bg-surface px-4 lg:hidden">
          <WorkspaceNav layout="tabs" pathname={pathname} isEmployer={isEmployer} />
        </div>
        <div key={identityScope(session)}>{children}</div>
      </div>
    </div>
  );
}

export function WorkspaceOverview() {
  return (
    <SignInGate message="登录后进入你的工作台">
      <WorkspaceDashboard />
    </SignInGate>
  );
}

export function MessagesPage() {
  const conversationId = useSearchParams().get("conversation");
  return (
    <SignInGate message="登录后管理你的聊天和求职沟通">
      <MessageWorkspace key={conversationId ?? "list"} initialId={conversationId} />
    </SignInGate>
  );
}

export function NotificationsPage() {
  return (
    <SignInGate message="登录后查看职位和聊天通知">
      <NotificationWorkspace />
    </SignInGate>
  );
}

export function ProfilePage() {
  return (
    <SignInGate message="登录后创建自己的个人主页">
      <ProfileWorkspace />
    </SignInGate>
  );
}
