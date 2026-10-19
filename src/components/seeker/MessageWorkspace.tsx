"use client";

import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { useChat, useChatRefresh, type Conversation, type Message } from "@/components/seeker/chat-client";
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

export function MessageWorkspace({ initialId }: { initialId: string | null }) {
  const t = useMessages(chatMessages).workspace;
  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const { messages, unread, totalUnread, conversations, markRead } = useChat();
  const session = useSession();
  const isEmployer = session?.activeRole === "employer";
  const demoAccount = isDemoAccount(session?.email);
  const selected = conversations.find((item) => item.id === selectedId);
  // #281: each conversation keeps its own draft in this tab, through a switch and a reload (chat-drafts.ts).
  const [draft, setDraft] = useChatDraft(identityScope(session), selected?.id ?? null);
  useChatRefresh();
  useUnreadInTitle(totalUnread);
  useMarkReadWhileVisible(selectedId, selected ? messages[selected.id] : undefined, markRead);

  function select(id: string) {
    setSelectedId(id);
    markRead(id);
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-title font-semibold">{isEmployer ? t.headingEmployer : t.headingSeeker}</h1>
        <p role="status" className="text-meta text-muted">
          {totalUnread ? t.unreadCount(totalUnread) : t.allRead}
          {demoAccount && <span className="ml-2">{t.demoData}</span>}
        </p>
      </header>

      <div
        data-chat-workspace=""
        className="grid h-[calc(100dvh_-_13rem_-_var(--bottom-nav-space))] min-h-[24rem] overflow-hidden rounded-card bg-surface shadow-card lg:h-[calc(100dvh_-_9rem)] lg:min-h-[30rem] lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)]"
      >
        <ConversationList
          conversations={conversations}
          messages={messages}
          unread={unread}
          selectedId={selected?.id}
          isEmployer={isEmployer}
          onSelect={select}
        />
        {selected ? (
          // #178: if the open chat fails, the list and the unsent draft (state up here) stay; 重试 redraws the chat.
          <RetryBoundary key={selected.id} title={t.threadFailedTitle} note={t.threadFailedNote}>
            <ChatThread
              conversation={selected}
              isEmployer={isEmployer}
              draft={draft}
              onDraftChange={setDraft}
              onBack={() => setSelectedId(null)}
            />
          </RetryBoundary>
        ) : (
          <NoConversationSelected totalUnread={totalUnread} />
        )}
      </div>
      <p className="text-meta text-muted">{demoAccount ? t.demoFooter : t.footer}</p>
    </div>
  );
}

/** Marks the open conversation read now and whenever the tab becomes visible again. */
function useMarkReadWhileVisible(
  conversationId: string | null,
  thread: Message[] | undefined,
  markRead: (id: string) => void,
) {
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
  unread,
  selectedId,
  isEmployer,
  onSelect,
}: Pick<ReturnType<typeof useChat>, "conversations" | "messages" | "unread"> & {
  selectedId: string | undefined;
  isEmployer: boolean;
  onSelect: (id: string) => void;
}) {
  const t = useMessages(chatMessages).workspace;
  return (
    <aside
      className={`${selectedId ? "hidden lg:block" : ""} min-h-0 overflow-y-auto lg:border-r lg:border-border`}
      aria-label={t.listLabel}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-subtitle font-semibold">{t.recent}</h2>
        <span className="text-meta text-muted">{t.conversationCount(conversations.length)}</span>
      </div>
      {conversations.length === 0 && (
        <p className="px-4 py-6 text-body text-muted">
          {t.empty}
          {isEmployer ? t.emptyEmployer : t.emptySeeker}
        </p>
      )}
      <ul className="space-y-0.5 p-1.5">
        {conversations.map((conversation) => (
          <li key={conversation.id}>
            <ConversationRow
              conversation={conversation}
              isEmployer={isEmployer}
              selected={selectedId === conversation.id}
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
  preview,
  unreadCount,
  onSelect,
}: {
  conversation: Conversation;
  isEmployer: boolean;
  selected: boolean;
  preview: string;
  unreadCount: number;
  onSelect: () => void;
}) {
  const lang = useLang();
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`pressable-row flex w-full items-center gap-3 rounded-control px-3 py-3 text-left hover:bg-background ${selected ? "bg-brand-soft hover:bg-brand-soft" : ""}`}
    >
      <CounterpartAvatar conversation={conversation} isEmployer={isEmployer} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span
            lang={contentLang(conversation.person)}
            className={`truncate text-body ${unreadCount ? "font-semibold" : "font-medium"}`}
          >
            {conversation.person}
          </span>
          <span className="shrink-0 text-meta text-muted">{shownTime(conversation.time, lang)}</span>
        </span>
        <span
          lang={contentLang(preview)}
          className={`mt-0.5 block truncate text-meta ${unreadCount ? "text-foreground" : "text-muted"}`}
        >
          {preview}
        </span>
      </span>
      <UnreadBadge count={unreadCount} />
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
