"use client";

import Link from "next/link";
import { useNotifications } from "@/components/seeker/hub-client";
import { notificationHref, type Notification } from "@/components/seeker/hub-state";
import { useSession } from "@/components/seeker/session-client";
import { workspaceTitle } from "@/components/seeker/workspace";

const ROW = "flex w-full gap-3 px-4 py-4 text-left hover:bg-background";

export function NotificationWorkspace() {
  const { items, unread, markRead } = useNotifications();
  const session = useSession();
  const isEmployer = session?.activeRole === "employer";

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-brand">{workspaceTitle(isEmployer)}</p>
          <h1 className="mt-1 text-2xl font-semibold">{isEmployer ? "招聘通知" : "求职通知"}</h1>
        </div>
        {unread > 0 && (
          <button
            type="button"
            onClick={() => markRead()}
            className="shrink-0 text-xs text-brand underline underline-offset-2"
          >
            全部标为已读
          </button>
        )}
      </header>
      <section className="overflow-hidden rounded-xl border border-border bg-surface" aria-label="通知列表">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-medium">全部通知</h2>
          <span className="text-xs text-muted">{unread ? `${unread} 条未读` : "已全部读完"}</span>
        </div>
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
      <button type="button" onClick={onOpen} className={ROW}>
        {content}
      </button>
    );
  }
  return (
    <Link href={href} onClick={onOpen} className={ROW}>
      {content}
    </Link>
  );
}

function NotificationContent({ item, hasLink }: { item: Notification; hasLink: boolean }) {
  return (
    <>
      <span
        className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-medium ${item.unread ? "bg-brand-soft text-brand" : "bg-background text-muted"}`}
      >
        {item.type.slice(0, 1)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <strong className="text-sm font-medium">{item.title}</strong>
          {item.unread && <span className="size-1.5 rounded-full bg-brand" aria-label="未读" />}
        </span>
        <span className="mt-1 block text-sm text-muted">{item.detail}</span>
        <span className="mt-1 block text-xs text-muted">{item.time}</span>
      </span>
      {hasLink && (
        <span aria-hidden="true" className="mt-2 text-muted">
          ›
        </span>
      )}
    </>
  );
}
