"use client";
// The 聊天 group's list and open conversation (#407, ADR 0046), loaded on demand by ModerationQueue: the composer it
// shares with 消息 (ChatThread) stays out of /admin's first load. The hooks and 和企业聊天 are in ModeratorChats.
import { useCallback, useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { getModeratorChatThread, sendModeratorChatMessage } from "@/app/[lang]/admin/chat-actions";
import type { Refused } from "@/app/[lang]/admin/actions";
import type { ModeratorChatSummary } from "@/db/moderator-chats";
import { isFailed, ready, settle, type Failed } from "@/app/[lang]/admin/load-state";
import { Empty, Loading } from "@/app/[lang]/admin/_components/Empty";
import { LoadFailed } from "@/app/[lang]/admin/_components/Failed";
import { useWhileVisible, type ChatList } from "@/app/[lang]/admin/_components/ModeratorChats";
import { UnreadBadge } from "@/components/seeker/ChatEntry";
import { ModeratorChatPanel } from "@/components/seeker/ModeratorChatPanel";
import { useOpenConversation, useVisibleViewport } from "@/components/seeker/fullscreen-chat";
import { useSession } from "@/components/seeker/session-client";
import { useLang, useMessages } from "@/i18n/client";
import { contentLang } from "@/i18n/lang";
import { formatDate } from "@/i18n/format";
import { moderatorChatMessages } from "@/i18n/messages/moderator-chat";
import type { ModeratorChatView } from "@/lib/moderator-chat";

const TIME: Intl.DateTimeFormatOptions = { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" };

export function ModeratorChats({ list, refresh }: { list: ChatList | Failed | undefined; refresh: () => void }) {
  const t = useMessages(moderatorChatMessages).admin;
  const { selectedId, open, close } = useOpenConversation();
  const board = useRef<HTMLDivElement>(null);
  const chats = ready(list)?.chats;
  const selected = selectedId ?? undefined;
  useVisibleViewport(board, Boolean(selected));

  if (isFailed(list)) return <LoadFailed what={t.listName} onRetry={refresh} />;
  if (!list) return <Loading cards={1} />;
  if ("refused" in list) return <Empty>{list.error_zh}</Empty>;

  return (
    <div
      ref={board}
      data-chat-workspace=""
      data-chat-open={selected ? "" : undefined}
      className={`grid overflow-hidden bg-surface lg:h-[calc(100dvh_-_16rem)] lg:min-h-[30rem] lg:rounded-card lg:ring-1 lg:ring-border lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)] ${
        selected
          ? "max-lg:fixed max-lg:inset-x-0 max-lg:top-(--chat-top,0px) max-lg:z-30 max-lg:h-(--chat-height,100dvh) max-lg:pt-[env(safe-area-inset-top)] max-lg:pb-[env(safe-area-inset-bottom)]"
          : "rounded-card ring-1 ring-border"
      }`}
    >
      <aside
        className={`${selected ? "hidden lg:block" : ""} min-h-0 overflow-y-auto lg:border-r lg:border-border`}
        aria-label={t.listLabel}
      >
        {chats?.length ? (
          <ul className="space-y-0.5 p-1.5">
            {chats.map((chat) => (
              <li key={chat.employerId}>
                <ChatRow chat={chat} selected={selected === chat.employerId} onSelect={() => open(chat.employerId)} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-6 text-body text-muted">{t.none}</p>
        )}
      </aside>
      {selected ? (
        <Thread key={selected} employerId={selected} onBack={close} onChanged={refresh} />
      ) : (
        <p className="hidden items-center justify-center px-4 text-body text-muted lg:flex">{t.pick}</p>
      )}
    </div>
  );
}

function ChatRow({
  chat,
  selected,
  onSelect,
}: {
  chat: ModeratorChatSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  const t = useMessages(moderatorChatMessages).admin;
  const lang = useLang();
  const preview = chat.last?.text ?? t.noMessages;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`pressable-row flex w-full items-center gap-3 rounded-control px-3 py-3 text-left hover:bg-background ${selected ? "bg-brand-soft hover:bg-brand-soft" : ""}`}
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span
            lang={contentLang(chat.employerName)}
            className={`truncate text-body ${chat.unread ? "font-semibold" : "font-medium"}`}
          >
            {chat.employerName}
          </span>
          <span className="shrink-0 text-meta text-muted">{formatDate(chat.updatedAt, lang, TIME)}</span>
        </span>
        <span
          lang={contentLang(preview)}
          className={`mt-0.5 block truncate text-meta ${chat.unread ? "text-foreground" : "text-muted"}`}
        >
          {preview}
        </span>
      </span>
      {chat.unread > 0 && <span className="sr-only">{t.unread(chat.unread)}</span>}
      <UnreadBadge count={chat.unread} />
    </button>
  );
}

/** The open conversation, read again every CHAT_REFRESH_MS while the page is in front (reading marks it read). */
function Thread({ employerId, onBack, onChanged }: { employerId: string; onBack: () => void; onChanged: () => void }) {
  const t = useMessages(moderatorChatMessages);
  const me = useSession()?.email;
  const [answer, setAnswer] = useState<{ view: ModeratorChatView | undefined } | Refused | Failed>();
  const load = useCallback(async () => {
    const got = await settle(() => getModeratorChatThread(employerId));
    setAnswer(got ?? { failed: true });
    return got;
  }, [employerId]);
  useEffect(() => {
    let live = true;
    // The list's unread count follows once this has marked the conversation read.
    void settle(() => getModeratorChatThread(employerId)).then((got) => {
      if (!live) return;
      setAnswer(got ?? { failed: true });
      onChanged();
    });
    return () => {
      live = false;
    };
  }, [employerId, onChanged]);
  useWhileVisible(
    true,
    useCallback(() => void load(), [load]),
  );

  if (!answer) return <Loading cards={1} />;
  if ("failed" in answer) return <LoadFailed what={t.admin.listName} onRetry={() => void load()} />;
  if ("refused" in answer) return <Empty>{answer.error_zh}</Empty>;
  const view = answer.view;
  if (!view) return <Empty>{t.employer.gone}</Empty>;
  return (
    <ModeratorChatPanel
      label={t.admin.threadName(view.employerName)}
      heading={view.employerName}
      avatar={
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-background"
        >
          <ShieldCheck className="size-5 text-muted" />
        </span>
      }
      note={t.admin.note}
      lines={view.lines}
      signature={(line) =>
        line.mine ? (line.by === me ? t.admin.you : line.by) : line.by && t.admin.teamSigned(view.employerName, line.by)
      }
      onSend={async (text) => {
        const sent = await settle(() => sendModeratorChatMessage(employerId, text));
        if (!sent) return { sent: false };
        if (!sent.ok) return { sent: false, error: sent.error_zh };
        await load();
        onChanged();
        return { sent: true };
      }}
      onBack={onBack}
      backLabel={t.admin.back}
    />
  );
}
