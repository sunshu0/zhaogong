"use client";

import Link from "next/link";
import { useRef } from "react";
import { ChevronRight } from "lucide-react";
import { useFreshAlertNotifications, useNotifications } from "@/components/seeker/hub-client";
import { notificationHref, type Notification } from "@/components/seeker/hub-state";
import { useSession } from "@/components/seeker/session-client";
import { workspaceTitle } from "@/components/seeker/workspace";
import { toast } from "@/components/ui/Toast";
import { useLang, useMessages } from "@/i18n/client";
import { contentLang } from "@/i18n/lang";
import { notificationsMessages } from "@/i18n/messages/notifications";

// Round 19 (操作质感): the list is one card; a row darkens while pressed, and an unread one has a brand tint.
const ROW =
  "pressable-row flex min-h-16 w-full gap-3 px-4 py-3.5 text-left hover:bg-background focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand lg:px-5";

/** The data's own keys for a notification's kind (申请, 面试…), by their key in the dictionary. */
const TYPE_KEYS: Record<string, keyof (typeof notificationsMessages)["zh"]["types"]> = {
  申请: "application",
  招聘: "hiring",
  团队: "team",
  验证: "verification",
  提醒: "alert",
  面试: "interview",
  聊天: "chat",
  简历: "resume",
  职位: "job",
};

export function NotificationWorkspace() {
  const { items, unread, markRead } = useNotifications();
  useFreshAlertNotifications();
  const session = useSession();
  const isEmployer = session?.activeRole === "employer";
  const lang = useLang();
  const t = useMessages(notificationsMessages);
  // #202: 全部标为已读 goes away once nothing is unread; the focus moves to the list's heading instead of the page top.
  const listHeading = useRef<HTMLHeadingElement>(null);

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-meta font-medium text-brand">{workspaceTitle(isEmployer, lang)}</p>
          <h1 className="mt-1 text-[1.75rem] leading-tight font-black">
            {isEmployer ? t.employerHeading : t.seekerHeading}
          </h1>
        </div>
        {unread > 0 && (
          <button
            type="button"
            onClick={() => {
              markRead();
              listHeading.current?.focus();
              toast(t.allMarkedRead);
            }}
            className="pressable -mr-2 inline-flex min-h-11 shrink-0 items-center rounded-control px-2 text-body font-medium text-brand hover:bg-brand-soft"
          >
            {t.markAllRead}
          </button>
        )}
      </header>
      <section className="overflow-hidden rounded-card bg-surface shadow-card" aria-label={t.listLabel}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3 lg:px-5">
          <h2 ref={listHeading} tabIndex={-1} className="text-subtitle font-semibold outline-none">
            {t.all}
          </h2>
          <span className="text-meta text-muted">{unread ? t.unreadCount(unread) : t.allRead}</span>
        </div>
        {items.length === 0 && <p className="px-4 py-10 text-center text-body text-muted">{t.empty}</p>}
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
  const t = useMessages(notificationsMessages);
  return (
    <>
      <span
        className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full text-meta font-semibold ${item.unread ? "bg-brand text-white" : "bg-neutral-soft text-muted"}`}
      >
        {TYPE_KEYS[item.type] ? t.badges[TYPE_KEYS[item.type]] : item.type.slice(0, 1)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <strong className={`text-body ${item.unread ? "font-semibold" : "font-medium"}`}>
            <Marked text={item.title} marks={item.marks} />
          </strong>
          {item.unread && <span className="size-2 shrink-0 rounded-full bg-brand" aria-label={t.unread} />}
        </span>
        <span className="mt-0.5 block text-body text-muted">
          <Marked text={item.detail} marks={item.marks} />
        </span>
        <span className="mt-1 block text-meta text-muted">{item.time}</span>
      </span>
      {hasLink && <ChevronRight aria-hidden="true" className="mt-2.5 size-4 shrink-0 text-muted" />}
    </>
  );
}

/**
 * A notification's sentence with people's own words in it (`marks`: a name, a job's title, a quoted reply): those
 * parts are marked lang="zh-CN" when Chinese, so an English page reads them as theirs (#244, ADR 0023 §6).
 */
function Marked({ text, marks = [] }: { text: string; marks?: readonly string[] }) {
  const words = [...marks].filter(Boolean).sort((a, b) => b.length - a.length);
  if (!words.length) return text;
  const parts: { text: string; theirs: boolean }[] = [];
  let rest = text;
  while (rest) {
    const at = words
      .map((word) => ({ word, index: rest.indexOf(word) }))
      .filter((hit) => hit.index >= 0)
      .sort((a, b) => a.index - b.index || b.word.length - a.word.length)[0];
    if (!at) {
      parts.push({ text: rest, theirs: false });
      break;
    }
    if (at.index > 0) parts.push({ text: rest.slice(0, at.index), theirs: false });
    parts.push({ text: at.word, theirs: true });
    rest = rest.slice(at.index + at.word.length);
  }
  return parts.map((part, i) =>
    part.theirs ? (
      <span key={i} lang={contentLang(part.text)}>
        {part.text}
      </span>
    ) : (
      part.text
    ),
  );
}
