"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MessageSquare, Pin } from "lucide-react";
import { useChat, useChatRefresh, type Conversation } from "@/components/seeker/chat-client";
import { CHAT_GROUPS, chatList, type ChatFilter } from "@/components/seeker/chat-list";
import { UnreadBadge } from "@/components/seeker/ChatEntry";
import { ChatThread } from "@/components/seeker/ChatThread";
import { useChatDraft } from "@/components/seeker/chat-drafts";
import { identityScope } from "@/components/seeker/identity-scope";
import { RetryBoundary } from "@/components/seeker/RetryBoundary";
import { CounterpartAvatar } from "@/components/seeker/ProfileAvatar";
import { useSession } from "@/components/seeker/session-client";
import { useLang, useMessages } from "@/i18n/client";
import { contentLang } from "@/i18n/lang";
import { chatMessages } from "@/i18n/messages/chat";
import { shownTime } from "@/components/seeker/chat-store";
import { isDemoAccount } from "@/lib/demo-accounts";
import { useOpenConversation, useVisibleViewport } from "@/components/seeker/fullscreen-chat";
import { MODERATOR_CHAT_ID, useModeratorChat } from "@/components/seeker/moderator-chat-client";
import { ModeratorChatPanel } from "@/components/seeker/ModeratorChatPanel";
import { ShieldCheck } from "lucide-react";
import { moderatorChatMessages } from "@/i18n/messages/moderator-chat";
import type { ModeratorChatView } from "@/lib/moderator-chat";

export function MessageWorkspace() {
  const t = useMessages(chatMessages).workspace;
  // T1 (ADR 0042): the open conversation is in the address, so the phone's back key closes it.
  const { selectedId, open, close } = useOpenConversation();
  const { messages, unread, totalUnread, conversations, exchanges, pinned, unreadMarks, markRead, markUnread } =
    useChat();
  const session = useSession();
  const isEmployer = session?.activeRole === "employer";
  const demoAccount = isDemoAccount(session?.email);
  const selected = conversations.find((item) => item.id === selectedId);
  // ADR 0046: the business's conversation with the moderators, pinned above the others.
  const moderators = useModeratorChat();
  const moderatorsOpen = selectedId === MODERATOR_CHAT_ID && moderators.view ? moderators.view : undefined;
  const anyOpen = Boolean(selected || moderatorsOpen);
  // C7 第 2 块: the conversation just marked unread is not read again while the address still names it (the phone's
  // back is async); any other address ends that.
  const [leaving, setLeaving] = useState<string | null>(null);
  if (leaving && leaving !== selectedId) setLeaving(null);
  // #281: each conversation keeps its own draft in this tab, through a switch and a reload (chat-drafts.ts).
  const [draft, setDraft] = useChatDraft(identityScope(session), selected?.id ?? null);
  useChatRefresh();
  useUnreadInTitle(totalUnread);
  useMarkReadWhileVisible(
    selected && selected.id !== leaving ? selected.id : null,
    selected ? messages[selected.id] : undefined,
    markRead,
  );
  useMarkReadWhileVisible(moderatorsOpen ? MODERATOR_CHAT_ID : null, moderatorsOpen?.lines, moderators.markRead);
  const board = useRef<HTMLDivElement>(null);
  useVisibleViewport(board, anyOpen);

  function select(id: string) {
    if (id !== selectedId) open(id);
    markRead(id);
  }

  // Leaving a conversation from inside it (返回, 标为未读) unmounts the button that had the focus: the focus goes to
  // the conversation's row in the list instead of the page's top, once the address no longer names it.
  const focusRow = useRef<string | null>(null);
  useEffect(() => {
    const id = focusRow.current;
    if (!id || selectedId === id) return;
    focusRow.current = null;
    board.current?.querySelector<HTMLElement>(`[data-conversation-row="${CSS.escape(id)}"]`)?.focus();
  }, [selectedId]);

  function leave(id: string) {
    focusRow.current = id;
    close();
  }

  function leaveUnread(id: string) {
    setLeaving(id);
    markUnread(id, true);
    leave(id);
  }

  // Below 1024 px an open conversation fills the screen (fixed over the page; globals.css hides the site's header,
  // footer and bottom bar while [data-chat-open] is on the page), so the heading and notes here step aside too.
  const besideChat = anyOpen ? "max-lg:hidden" : "";
  return (
    <div className="space-y-4">
      <header className={`flex items-center justify-between gap-3 ${besideChat}`}>
        <h1 className="text-title font-semibold">{isEmployer ? t.headingEmployer : t.headingSeeker}</h1>
        <p role="status" className="text-meta text-muted">
          {totalUnread ? t.unreadCount(totalUnread) : t.allRead}
          {demoAccount && <span className="ml-2">{t.demoData}</span>}
        </p>
      </header>

      <div
        ref={board}
        data-chat-workspace=""
        data-chat-open={anyOpen ? "" : undefined}
        className={`grid overflow-hidden bg-surface lg:h-[calc(100dvh_-_9rem)] lg:min-h-[30rem] lg:rounded-card lg:ring-1 lg:ring-border lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)] ${
          anyOpen
            ? "max-lg:fixed max-lg:inset-x-0 max-lg:top-(--chat-top,0px) max-lg:z-30 max-lg:h-(--chat-height,100dvh) max-lg:pt-[env(safe-area-inset-top)] max-lg:pb-[env(safe-area-inset-bottom)]"
            : "h-[calc(100dvh_-_13rem_-_var(--bottom-nav-space))] min-h-[24rem] rounded-card ring-1 ring-border"
        }`}
      >
        <ConversationList
          conversations={conversations}
          messages={messages}
          exchanges={exchanges}
          pinned={pinned}
          unreadMarks={unreadMarks}
          unread={unread}
          selectedId={selected?.id ?? (moderatorsOpen ? MODERATOR_CHAT_ID : undefined)}
          isEmployer={isEmployer}
          onSelect={select}
          moderators={
            moderators.view && (
              <ModeratorRow
                view={moderators.view}
                selected={Boolean(moderatorsOpen)}
                onSelect={() => select(MODERATOR_CHAT_ID)}
              />
            )
          }
        />
        {moderatorsOpen ? (
          <RetryBoundary key={MODERATOR_CHAT_ID} title={t.threadFailedTitle} note={t.threadFailedNote}>
            <ModeratorThread view={moderatorsOpen} send={moderators.send} onBack={close} />
          </RetryBoundary>
        ) : selected ? (
          // #178: if the open chat fails, the list and the unsent draft (state up here) stay; 重试 redraws the chat.
          <RetryBoundary key={selected.id} title={t.threadFailedTitle} note={t.threadFailedNote}>
            <ChatThread
              conversation={selected}
              isEmployer={isEmployer}
              draft={draft}
              onDraftChange={setDraft}
              onBack={() => leave(selected.id)}
              onMarkUnread={() => leaveUnread(selected.id)}
            />
          </RetryBoundary>
        ) : (
          <NoConversationSelected totalUnread={totalUnread} />
        )}
      </div>
      <p className={`text-meta text-muted ${besideChat}`}>{demoAccount ? t.demoFooter : t.footer}</p>
    </div>
  );
}

/** Marks the open conversation read now and whenever the tab becomes visible again. */
function useMarkReadWhileVisible(conversationId: string | null, thread: unknown, markRead: (id: string) => void) {
  useEffect(() => {
    const readVisible = () => {
      if (conversationId && document.visibilityState === "visible") markRead(conversationId);
    };
    readVisible();
    document.addEventListener("visibilitychange", readVisible);
    return () => document.removeEventListener("visibilitychange", readVisible);
  }, [conversationId, thread, markRead]);
}

function ConversationList({
  conversations,
  messages,
  exchanges,
  pinned,
  unreadMarks,
  unread,
  selectedId,
  isEmployer,
  onSelect,
  moderators,
}: Pick<
  ReturnType<typeof useChat>,
  "conversations" | "messages" | "exchanges" | "pinned" | "unreadMarks" | "unread"
> & {
  selectedId: string | undefined;
  isEmployer: boolean;
  onSelect: (id: string) => void;
  /** The conversation with the moderators (ADR 0046), above the others and in no group. */
  moderators?: ReactNode;
}) {
  const t = useMessages(chatMessages).workspace;
  // C7 (ADR 0053): 全部 / 新招呼 / 沟通中 / 已约面 in the row the heading had, so the list loses no row on a phone.
  const [filter, setFilter] = useState<ChatFilter>("all");
  const { rows, counts } = chatList({ conversations, messages, exchanges, pinned }, filter);
  return (
    <aside
      className={`${selectedId ? "hidden lg:block" : ""} min-h-0 overflow-y-auto lg:border-r lg:border-border`}
      aria-label={t.listLabel}
    >
      <h2 className="sr-only">
        {t.recent} · {t.conversationCount(conversations.length)}
      </h2>
      {/* With no conversation yet there is nothing to filter: the row stays out. */}
      {conversations.length > 0 && (
        <div
          role="group"
          aria-label={t.filterLabel}
          className="flex gap-1 overflow-x-auto border-b border-border p-1.5 [scrollbar-width:none]"
        >
          {(["all", ...CHAT_GROUPS] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
              className={`pressable min-h-11 shrink-0 rounded-full px-3 text-meta whitespace-nowrap ${
                filter === key ? "bg-brand-soft font-semibold text-brand" : "text-muted hover:bg-background"
              }`}
            >
              {t.filters[key]} <span className="tabular-nums">{counts[key]}</span>
            </button>
          ))}
        </div>
      )}
      {moderators && <div className="border-b border-border p-1.5">{moderators}</div>}
      {conversations.length === 0 && (
        <p className="px-4 py-6 text-body text-muted">
          {t.empty}
          {isEmployer ? t.emptyEmployer : t.emptySeeker}
        </p>
      )}
      {conversations.length > 0 && rows.length === 0 && (
        <p className="px-4 py-6 text-body text-muted">{t.filterEmpty(t.filters[filter])}</p>
      )}
      <ul className="space-y-0.5 p-1.5">
        {rows.map((conversation) => (
          <li key={conversation.id}>
            <ConversationRow
              conversation={conversation}
              isEmployer={isEmployer}
              selected={selectedId === conversation.id}
              pinned={Boolean(pinned[conversation.id])}
              marked={Boolean(unreadMarks[conversation.id])}
              preview={messages[conversation.id].at(-1)?.text ?? t.previewEmpty}
              unreadCount={unread[conversation.id]}
              onSelect={() => onSelect(conversation.id)}
            />
          </li>
        ))}
      </ul>
    </aside>
  );
}

function ConversationRow({
  conversation,
  isEmployer,
  selected,
  pinned,
  marked,
  preview,
  unreadCount,
  onSelect,
}: {
  conversation: Conversation;
  isEmployer: boolean;
  selected: boolean;
  pinned: boolean;
  /** C7 第 2 块: marked unread by hand — a dot where the count would be, and no count of its own. */
  marked: boolean;
  preview: string;
  unreadCount: number;
  onSelect: () => void;
}) {
  const lang = useLang();
  const t = useMessages(chatMessages).workspace;
  const stands = Boolean(unreadCount) || marked;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected || undefined}
      data-conversation-row={conversation.id}
      className={`pressable-row flex w-full items-center gap-3 rounded-control px-3 py-3 text-left hover:bg-background ${selected ? "bg-brand-soft hover:bg-brand-soft" : ""}`}
    >
      <CounterpartAvatar conversation={conversation} isEmployer={isEmployer} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span
            lang={contentLang(conversation.person)}
            className={`truncate text-body ${stands ? "font-semibold" : "font-medium"}`}
          >
            {conversation.person}
          </span>
          <span className="flex shrink-0 items-center gap-1 text-meta text-muted">
            {pinned && (
              <>
                <Pin aria-hidden="true" className="size-3.5 text-brand" />
                <span className="sr-only">{t.pinned}</span>
              </>
            )}
            {shownTime(conversation.time, lang)}
          </span>
        </span>
        <span
          lang={contentLang(preview)}
          className={`mt-0.5 block truncate text-meta ${stands ? "text-foreground" : "text-muted"}`}
        >
          {preview}
        </span>
      </span>
      {unreadCount ? (
        <>
          <UnreadBadge count={unreadCount} />
          {/* The badge is hidden from screen readers; this says it (UI audit 1 #6). */}
          <span className="sr-only">{t.unreadCount(unreadCount)}</span>
        </>
      ) : (
        marked && (
          <>
            <span aria-hidden="true" data-unread-mark="" className="size-2.5 shrink-0 rounded-full bg-accent" />
            <span className="sr-only">{t.markedUnread}</span>
          </>
        )
      )}
    </button>
  );
}

function NoConversationSelected({ totalUnread }: { totalUnread: number }) {
  const t = useMessages(chatMessages).workspace;
  return (
    <section
      className="hidden min-h-64 flex-col items-center justify-center gap-3 bg-background/50 px-4 text-center lg:flex"
      aria-label={t.pickerLabel}
    >
      <MessageSquare aria-hidden="true" className="size-12 text-brand" />
      <h2 className="text-subtitle font-semibold">{t.pickerTitle}</h2>
      <p className="text-body text-muted">{totalUnread ? t.pickerUnread(totalUnread) : t.pickerNoUnread}</p>
    </section>
  );
}

/** The "(N) " before a page title that counts unread messages. */
const UNREAD_PREFIX = /^\(\d+\) /;

/**
 * #291: with unread messages the tab's title starts with their count, "(2) 消息 · 找工", so a chat left in a
 * background tab shows that something came; reading them takes it away, and leaving the page restores the title (the
 * next page's own title replaces it anyway). Next sets the page's title from its metadata after this page has
 * mounted (gate25: the count was gone), so the title is watched and the count put back whenever it is replaced.
 */
function useUnreadInTitle(count: number) {
  useEffect(() => {
    const apply = () => {
      const title = document.title.replace(UNREAD_PREFIX, "");
      const wanted = count > 0 ? `(${count}) ${title}` : title;
      if (document.title !== wanted) document.title = wanted;
    };
    apply();
    const watcher = new MutationObserver(apply);
    watcher.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => {
      watcher.disconnect();
      document.title = document.title.replace(UNREAD_PREFIX, "");
    };
  }, [count]);
}

/** The moderators' avatar: the site's shield, not a person. */
function ModeratorAvatar() {
  return (
    <span
      aria-hidden="true"
      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"
    >
      <ShieldCheck className="size-5" />
    </span>
  );
}

/** ADR 0046: the conversation with 找工审核员, pinned above the job seekers' and marked 官方. */
function ModeratorRow({
  view,
  selected,
  onSelect,
}: {
  view: ModeratorChatView;
  selected: boolean;
  onSelect: () => void;
}) {
  const t = useMessages(moderatorChatMessages);
  const workspace = useMessages(chatMessages).workspace;
  const preview = view.lines.at(-1)?.text ?? t.empty;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected || undefined}
      data-moderator-chat=""
      className={`pressable-row flex w-full items-center gap-3 rounded-control px-3 py-3 text-left hover:bg-background ${selected ? "bg-brand-soft hover:bg-brand-soft" : ""}`}
    >
      <ModeratorAvatar />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={`truncate text-body ${view.unread ? "font-semibold" : "font-medium"}`}>{t.name}</span>
          <span className="shrink-0 rounded-full bg-brand-soft px-2 text-meta font-medium text-brand">
            {t.employer.rowNote}
          </span>
        </span>
        <span
          lang={contentLang(preview)}
          className={`mt-0.5 block truncate text-meta ${view.unread ? "text-foreground" : "text-muted"}`}
        >
          {preview}
        </span>
      </span>
      <UnreadBadge count={view.unread} />
      {view.unread > 0 && <span className="sr-only">{workspace.unreadCount(view.unread)}</span>}
    </button>
  );
}

function ModeratorThread({
  view,
  send,
  onBack,
}: {
  view: ModeratorChatView;
  send: ReturnType<typeof useModeratorChat>["send"];
  onBack: () => void;
}) {
  const t = useMessages(moderatorChatMessages);
  return (
    <ModeratorChatPanel
      label={t.employer.label}
      heading={t.name}
      avatar={<ModeratorAvatar />}
      note={t.employer.note}
      lines={view.lines}
      signature={(line) => (line.mine ? line.by : undefined)}
      onSend={send}
      onBack={onBack}
      backLabel={t.employer.back}
    />
  );
}
