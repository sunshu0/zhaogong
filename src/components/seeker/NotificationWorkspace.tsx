"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useFreshAlertNotifications, useNotifications } from "@/components/seeker/hub-client";
import { notificationHref, type Notification } from "@/components/seeker/hub-state";
import { useSession } from "@/components/seeker/session-client";
import { workspaceTitle } from "@/components/seeker/workspace";
import { toast } from "@/components/ui/Toast";

// Round 19 (操作质感): the list is one card; a row darkens while pressed, and an unread one has a brand tint.
const ROW =
  "pressable-row flex min-h-16 w-full gap-3 px-4 py-3.5 text-left hover:bg-background focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand lg:px-5";

export function NotificationWorkspace() {
  const { items, unread, markRead } = useNotifications();
  useFreshAlertNotifications();
  const session = useSession();
  const isEmployer = session?.activeRole === "employer";

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-meta font-medium text-brand">{workspaceTitle(isEmployer)}</p>
          <h1 className="mt-1 text-[1.75rem] leading-tight font-black">{isEmployer ? "招聘通知" : "求职通知"}</h1>
        </div>
        {unread > 0 && (
          <button
            type="button"
            onClick={() => {
              markRead();
              toast("已全部标为已读");
            }}
            className="pressable -mr-2 inline-flex min-h-11 shrink-0 items-center rounded-control px-2 text-body font-medium text-brand hover:bg-brand-soft"
          >
            全部标为已读
          </button>
        )}
      </header>
      <section className="overflow-hidden rounded-card bg-surface shadow-card" aria-label="通知列表">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 lg:px-5">
          <h2 className="text-subtitle font-semibold">全部通知</h2>
          <span className="text-meta text-muted">{unread ? `${unread} 条未读` : "已全部读完"}</span>
        </div>
        {items.length === 0 && <p className="px-4 py-10 text-center text-body text-muted">还没有通知。</p>}
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.id}>
              <NotificationRow item={item} href={notificationHref(item, session)} onOpen={() => markRead(item.id)} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** A notification with somewhere to go is a link; the others are buttons that only mark it read. */
function NotificationRow({ item, href, onOpen }: { item: Notification; href?: string; onOpen: () => void }) {
  const content = <NotificationContent item={item} hasLink={Boolean(href)} />;
  if (!href) {
    return (
      <button type="button" onClick={onOpen} className={`${ROW} ${tint(item)}`}>
        {content}
      </button>
    );
  }
  return (
    <Link href={href} onClick={onOpen} className={`${ROW} ${tint(item)}`}>
      {content}
    </Link>
  );
}

const tint = (item: Notification) => (item.unread ? "bg-brand-soft/40" : "");

function NotificationContent({ item, hasLink }: { item: Notification; hasLink: boolean }) {
  return (
    <>
      <span
        className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full text-meta font-semibold ${item.unread ? "bg-brand text-white" : "bg-neutral-soft text-muted"}`}
      >
        {item.type.slice(0, 1)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <strong className={`text-body ${item.unread ? "font-semibold" : "font-medium"}`}>{item.title}</strong>
          {item.unread && <span className="size-2 shrink-0 rounded-full bg-brand" aria-label="未读" />}
        </span>
        <span className="mt-0.5 block text-body text-muted">{item.detail}</span>
        <span className="mt-1 block text-meta text-muted">{item.time}</span>
      </span>
      {hasLink && <ChevronRight aria-hidden="true" className="mt-2.5 size-4 shrink-0 text-muted" />}
    </>
  );
}
