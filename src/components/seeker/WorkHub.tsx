"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, Send, MessageSquare, ExternalLink } from "lucide-react";
import { useHydrated, useSession } from "@/components/seeker/session-client";
import { WIDE_ON_DESKTOP } from "@/components/ui/wide";
import { conversationProfileHref, useChat } from "@/components/seeker/chat-client";
import { UnreadBadge } from "@/components/seeker/ChatEntry";
import { identityScope } from "@/components/seeker/identity-scope";
import { useNotifications, useProfile } from "@/components/seeker/hub-client";
import { notificationHref, type Profile } from "@/components/seeker/hub-state";
import { ResumeEditor } from "@/components/seeker/ResumeEditor";
import { ChatExchangeList, ChatExchangeTools, ChatReportButton } from "@/components/seeker/ChatInteractions";
import { ChatActivity } from "@/components/seeker/ChatActivity";
import { messageReadLabel } from "@/lib/chat-activity";
import { CounterpartAvatar, ProfileAvatarEditor } from "@/components/seeker/ProfileAvatar";

const WORKSPACE_NAV = [
  { href: "/workspace", label: "工作台总览", short: "总览" },
  { href: "/messages", label: "聊天", short: "聊天" },
  { href: "/notifications", label: "通知", short: "通知" },
  { href: "/profile", label: "我的主页", short: "主页" },
  { href: "/me", label: "我的记录", short: "记录" },
];

export function WorkHubFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const session = useSession();
  const { totalUnread } = useChat();
  const { unread: notificationUnread } = useNotifications();
  const nav = workspaceNav(session?.activeRole === "employer");
  const isChat = pathname === "/messages";

  return (
    <div className={`${isChat ? "lg:ml-[calc(50%_-_min(48rem,_50vw_-_1.5rem))] lg:w-[min(96rem,_100vw_-_3rem)]" : WIDE_ON_DESKTOP} space-y-4 lg:grid lg:grid-cols-[10rem_minmax(0,1fr)] lg:items-start lg:gap-5 lg:space-y-0`}>
      <aside className="hidden lg:sticky lg:top-[4.5rem] lg:block">
        <div className="border-r border-border pr-4 py-3">
          <div className="border-b border-border px-2 pb-3">
            <p className="text-xs font-medium text-brand">找工</p>
            <h2 className="mt-1 text-lg font-semibold">工作台</h2>
          </div>
          <WorkspaceNav pathname={pathname} />
          {session && <p className="mt-3 border-t border-border px-2 pt-3 text-xs text-muted">{session.activeRole === "employer" ? "雇主工作台" : "求职者工作台"}</p>}
        </div>
      </aside>
      <div className="min-w-0 space-y-4 lg:space-y-0">
        <div className="-mx-4 overflow-x-auto border-b border-border bg-surface px-4 lg:hidden">
          <nav aria-label="工作台导航" className="flex min-w-max gap-1 py-2">
            {nav.map((item) => {
              const active = pathname === item.href;
              return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm ${active ? "bg-brand-soft font-medium text-brand" : "text-muted"}`}>{item.short}{item.href === "/messages" && <UnreadBadge count={totalUnread} />}{item.href === "/notifications" && <UnreadBadge count={notificationUnread} />}</Link>;
            })}
          </nav>
        </div>
        <div key={identityScope(session)}>{children}</div>
      </div>
    </div>
  );
}

function WorkspaceNav({ pathname }: { pathname: string }) {
  const { totalUnread } = useChat();
  const { unread } = useNotifications();
  const session = useSession();
  return <nav aria-label="工作台导航" className="mt-3 space-y-1">{workspaceNav(session?.activeRole === "employer").map((item) => {
    const active = pathname === item.href;
    return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center justify-between gap-2 rounded-lg px-2.5 text-sm ${active ? "bg-brand-soft font-medium text-brand" : "hover:bg-background"}`}>{item.label}{item.href === "/messages" && <UnreadBadge count={totalUnread} />}{item.href === "/notifications" && <UnreadBadge count={unread} />}</Link>;
  })}</nav>;
}

function workspaceNav(isEmployer: boolean) {
  const items = isEmployer ? [...WORKSPACE_NAV.slice(0, 2), { href: "/employer/candidates", label: "推荐人才", short: "人才" }, ...WORKSPACE_NAV.slice(2)] : WORKSPACE_NAV;
  return items.map((item) => isEmployer && item.href === "/profile" ? { ...item, label: "企业主页", short: "企业" }
    : isEmployer && item.href === "/me" ? { ...item, label: "招聘记录", short: "招聘" } : item);
}

export function WorkspaceOverview() {
  const { totalUnread, unread, messages, conversations } = useChat();
  const session = useSession();
  const { unread: notificationUnread } = useNotifications();
  const isEmployer = session?.activeRole === "employer";
  const recent = conversations[0];
  const { signedIn, gate } = useSignedIn();
  if (!signedIn) return gate("登录后进入你的工作台");
  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-medium text-brand">找工 · 工作台</p>
        <h1 className="mt-1 text-2xl font-semibold">{isEmployer ? "雇主工作台" : "求职者工作台"}</h1>
        {isEmployer && <p className="mt-1 text-sm text-muted">{session.employerName}</p>}
      </header>
      {isEmployer && <Link href="/employer/candidates" className="flex items-center justify-between gap-3 border-y border-border py-4"><div><p className="font-semibold text-brand">推荐人才</p><p className="mt-1 text-sm text-muted">查看与你的招聘要求匹配的求职者</p></div><span aria-hidden="true" className="text-brand">→</span></Link>}
      <section className="grid gap-3 sm:grid-cols-3" aria-label="工作台摘要">
        <Link href="/messages" className="rounded-lg border border-brand/30 bg-brand-soft p-4 hover:border-brand"><p className="flex items-center gap-2 font-semibold text-brand"><MessageSquare aria-hidden="true" className="size-5" />聊天 <UnreadBadge count={totalUnread} /></p><p className="mt-2 text-sm text-muted">{totalUnread ? `${totalUnread} 条未读消息` : "暂无未读消息"}</p></Link>
        <Link href="/notifications" className="rounded-lg border border-border bg-surface p-4 hover:border-brand/40"><p className="flex items-center gap-2 font-medium text-brand">通知 <UnreadBadge count={notificationUnread} /></p><p className="mt-2 text-sm text-muted">{isEmployer ? "应聘与招聘动态" : "职位与简历动态"}</p></Link>
        <Link href="/profile" className="rounded-lg border border-border bg-surface p-4 hover:border-brand/40"><p className="font-medium text-brand">{isEmployer ? "企业主页" : "我的主页"}</p><p className="mt-2 text-sm text-muted">{isEmployer ? "企业资料与招聘联系人" : "个人资料"}</p></Link>
      </section>
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="rounded-lg border border-border bg-surface p-4"><div className="flex items-center justify-between gap-3"><h2 className="font-medium">最近聊天</h2><Link href="/messages" className="text-xs text-brand underline underline-offset-2">查看全部</Link></div><Link href="/messages" className="mt-3 flex items-center gap-3 border-t border-border pt-3"><Avatar text={recent.avatar} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{recent.person}</p><p className="mt-1 truncate text-xs text-muted">{messages[recent.id].at(-1)?.text}</p></div><UnreadBadge count={unread[recent.id]} /></Link></div>
        <div className="space-y-3 border-l border-border pl-4"><h2 className="font-medium">{isEmployer ? "招聘管理" : "求职资料"}</h2><Link href="/profile" className="block text-sm text-brand underline">{isEmployer ? "完善企业主页" : "完善我的主页"}</Link><Link href="/me" className="block text-sm text-brand underline">{isEmployer ? "查看招聘记录" : "查看求职记录"}</Link>{isEmployer && <Link href="/employer/post" className="inline-flex rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white">发布新职位</Link>}</div>
      </section>
      {session && <p className="text-xs text-muted">当前账号：{session.email} · 演示数据</p>}
    </div>
  );
}

export function MessagesPage() {
  const { signedIn, gate } = useSignedIn();
  const conversationId = useSearchParams().get("conversation");
  if (!signedIn) return gate("登录后管理你的聊天和求职沟通");
  return <MessageWorkspace key={conversationId ?? "list"} initialId={conversationId} />;
}

function MessageWorkspace({ initialId }: { initialId: string | null }) {
  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const { messages, unread, totalUnread, conversations, exchanges, markRead, send: sendMessage } = useChat();
  const isEmployer = useSession()?.activeRole === "employer";
  const [draft, setDraft] = useState("");
  const selected = conversations.find((item) => item.id === selectedId);
  const profileHref = selected ? conversationProfileHref(selected, isEmployer) : undefined;
  const thread = selected ? messages[selected.id] : undefined;
  const messageList = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const readVisible = () => {
      if (selectedId && document.visibilityState === "visible") markRead(selectedId);
    };
    readVisible();
    document.addEventListener("visibilitychange", readVisible);
    return () => document.removeEventListener("visibilitychange", readVisible);
  }, [selectedId, thread, markRead]);
  useEffect(() => {
    const list = messageList.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [thread, exchanges]);

  function send(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !selected) return;
    sendMessage(selected.id, text);
    setDraft("");
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{isEmployer ? "招聘聊天" : "求职聊天"}</h1>
        <p role="status" className="text-sm text-muted">{totalUnread ? `${totalUnread} 条未读消息` : "消息已全部读完"}<span className="ml-2 text-xs">演示数据</span></p>
      </header>

      <div data-chat-workspace="" className="grid h-[calc(100dvh_-_13rem)] min-h-[24rem] overflow-hidden rounded-lg border border-border bg-surface lg:h-[calc(100dvh_-_9rem)] lg:min-h-[30rem] lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className={`${selected ? "hidden lg:block" : ""} min-h-0 overflow-y-auto lg:border-r lg:border-border`} aria-label="聊天列表">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-medium">最近联系</h2>
            <span className="text-xs text-muted">{conversations.length} 个会话</span>
          </div>
          <ul className="divide-y divide-border">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <button
                  type="button"
                  onClick={() => { setSelectedId(conversation.id); markRead(conversation.id); setDraft(""); }}
                  aria-pressed={selected?.id === conversation.id}
                  className={`flex w-full gap-3 px-4 py-4 text-left hover:bg-background ${selected?.id === conversation.id ? "bg-brand-soft" : ""}`}
                >
                  <CounterpartAvatar conversation={conversation} isEmployer={isEmployer} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{conversation.person}</span>
                      <span className="shrink-0 text-[11px] text-muted">{conversation.time}</span>
                    </span>
                    <span className="mt-1 block truncate text-sm text-muted">{messages[conversation.id].at(-1)?.text ?? "尚未发送消息"}</span>
                  </span>
                  <UnreadBadge count={unread[conversation.id]} />
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {selected ? <section className="flex min-h-0 min-w-0 flex-col" aria-label={`与${selected.person}的聊天`}>
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <button type="button" onClick={() => setSelectedId(null)} aria-label="返回会话列表" title="返回会话列表" className="flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-background lg:hidden"><ArrowLeft aria-hidden="true" className="size-5" /></button>
            {profileHref ? <Link href={profileHref} aria-label={`查看${selected.person}的主页`} title={`查看${selected.person}的主页`} className="group flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-brand">
              <CounterpartAvatar conversation={selected} isEmployer={isEmployer} />
              <div className="min-w-0"><h2 className="break-words font-medium leading-snug group-hover:text-brand group-hover:underline sm:truncate">{selected.person}</h2><p className="truncate text-xs text-muted">{isEmployer ? "应聘" : "招聘"}：{selected.title}</p></div>
            </Link> : <div className="flex min-w-0 flex-1 items-center gap-2"><CounterpartAvatar conversation={selected} isEmployer={isEmployer} /><div className="min-w-0"><h2 className="truncate font-medium">{selected.person}</h2><p className="truncate text-xs text-muted">{isEmployer ? "应聘" : "招聘"}：{selected.title}</p></div></div>}
            <div className="ml-auto flex shrink-0 flex-col gap-1 text-right sm:flex-row sm:gap-3">
              {!isEmployer && "employerId" in selected && typeof selected.employerId === "string" && <Link href={`/employers/${selected.employerId}`} className="text-sm text-brand underline underline-offset-2">雇主主页</Link>}
              {selected.job && <Link href={`/jobs/${selected.job}`} className="text-sm text-brand underline underline-offset-2">查看职位</Link>}
            </div>
            <ChatReportButton key={selected.id} conversation={selected} />
          </div>

          <ChatActivity conversation={selected} isEmployer={isEmployer} conversations={conversations} messages={messages} />

          <div ref={messageList} role="log" aria-label="消息记录" tabIndex={0} className="h-80 min-h-0 flex-1 space-y-4 overflow-y-auto bg-background/60 px-4 py-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand lg:h-auto lg:px-6" aria-live="polite">
            {!thread?.length && <p className="text-center text-sm text-muted">尚未发送消息</p>}
            {thread?.map((message, index) => (
              <div key={`${message.time}-${index}`} className={`flex ${message.from === "me" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] break-words rounded-lg px-4 py-3 text-sm leading-relaxed lg:max-w-[75%] lg:text-base ${message.from === "me" ? "bg-brand text-white" : "border border-border bg-surface"}`}>
                  <p>{message.text}</p>
                  <p className={`mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${message.from === "me" ? "text-white" : "text-muted"}`}><span>{message.time}</span><span data-message-read="" aria-label={message.from === "me" ? `对方${messageReadLabel(message)}` : messageReadLabel(message)}>{messageReadLabel(message)}</span></p>
                </div>
              </div>
            ))}
            <ChatExchangeList key={selected.id} conversationId={selected.id} />
          </div>

          <div className="shrink-0 border-t border-border px-4 py-3 lg:px-6 lg:py-4">
            <ChatExchangeTools key={selected.id} conversationId={selected.id} />
            <form onSubmit={send} className="flex items-end gap-2">
              <label className="sr-only" htmlFor="message-draft">输入消息</label>
              <textarea id="message-draft" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="输入消息…" rows={3} className="min-h-11 min-w-0 flex-1 resize-none rounded-lg border border-border bg-surface px-3 py-2 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
              <button type="submit" disabled={!draft.trim()} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"><Send aria-hidden="true" className="size-4" />发送</button>
            </form>
          </div>
        </section> : <section className="hidden min-h-64 flex-col items-center justify-center gap-3 bg-background/50 px-4 text-center lg:flex" aria-label="选择会话"><MessageSquare aria-hidden="true" className="size-12 text-brand" /><h2 className="text-lg font-medium">选择一位联系人</h2><p className="text-sm text-muted">{totalUnread ? `你有 ${totalUnread} 条未读消息` : "暂无未读消息"}</p></section>}
      </div>
      <p className="text-xs text-muted">演示版：消息与已读状态保存在这台设备上。</p>
    </div>
  );
}

export function NotificationsPage() {
  const { signedIn, gate } = useSignedIn();
  if (!signedIn) return gate("登录后查看职位和聊天通知");
  return <NotificationWorkspace />;
}

function NotificationWorkspace() {
  const { items, unread, markRead } = useNotifications();
  const session = useSession();
  const isEmployer = session?.activeRole === "employer";

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between gap-3">
        <div><p className="text-xs font-medium text-brand">{isEmployer ? "雇主工作台" : "求职者工作台"}</p><h1 className="mt-1 text-2xl font-semibold">{isEmployer ? "招聘通知" : "求职通知"}</h1></div>
        {unread > 0 && <button type="button" onClick={() => markRead()} className="shrink-0 text-xs text-brand underline underline-offset-2">全部标为已读</button>}
      </header>
      <section className="overflow-hidden rounded-xl border border-border bg-surface" aria-label="通知列表">
        <div className="flex items-center justify-between border-b border-border px-4 py-3"><h2 className="font-medium">全部通知</h2><span className="text-xs text-muted">{unread ? `${unread} 条未读` : "已全部读完"}</span></div>
        <ul className="divide-y divide-border">
          {items.map((item) => {
            const href = notificationHref(item, session);
            const content = <><span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-medium ${item.unread ? "bg-brand-soft text-brand" : "bg-background text-muted"}`}>{item.type.slice(0, 1)}</span><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><strong className="text-sm font-medium">{item.title}</strong>{item.unread && <span className="size-1.5 rounded-full bg-brand" aria-label="未读" />}</span><span className="mt-1 block text-sm text-muted">{item.detail}</span><span className="mt-1 block text-xs text-muted">{item.time}</span></span>{href && <span aria-hidden="true" className="mt-2 text-muted">›</span>}</>;
            const className = "flex w-full gap-3 px-4 py-4 text-left hover:bg-background";
            return <li key={item.id}>{href
              ? <Link href={href} onClick={() => markRead(item.id)} className={className}>{content}</Link>
              : <button type="button" onClick={() => markRead(item.id)} className={className}>{content}</button>}</li>;
          })}
        </ul>
      </section>
    </div>
  );
}

export function ProfilePage() {
  const { signedIn, gate } = useSignedIn();
  if (!signedIn) return gate("登录后创建自己的个人主页");
  return <ProfileWorkspace />;
}

function ProfileWorkspace() {
  const { profile, update: updateProfile } = useProfile();
  const session = useSession();
  const isEmployer = session?.activeRole === "employer";
  const [saved, setSaved] = useState(false);

  function update<K extends keyof Profile>(field: K, value: Profile[K]) {
    setSaved(false);
    return updateProfile({ [field]: value });
  }

  function save(event: FormEvent) {
    event.preventDefault();
    updateProfile(profile);
    setSaved(true);
  }

  return (
    <div className="space-y-4">
      <header><p className="text-xs font-medium text-brand">{isEmployer ? "雇主工作台" : "求职者工作台"}</p><h1 className="mt-1 text-2xl font-semibold">{isEmployer ? "企业主页" : "我的求职主页"}</h1></header>
      {isEmployer && <div className="flex flex-wrap items-center gap-3 border-b border-border pb-4"><Link href={`/employers/${session.employerId}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand underline"><ExternalLink aria-hidden="true" className="size-4" />查看公开主页</Link><Link href="/employer/verify" className="inline-flex min-h-11 items-center text-sm text-brand underline">管理公司资质</Link><p className="text-xs text-muted">企业资料对求职者公开；本机演示资料。</p></div>}
      <form onSubmit={save} className="space-y-4">
        <section className="flex flex-wrap items-center gap-3 border-b border-border py-4"><ProfileAvatarEditor value={profile.avatar} fallback={profile.name.slice(0, 1) || "我"} onChange={(avatar) => update("avatar", avatar)} /><div><p className="font-medium">{profile.name || (isEmployer ? "企业名称" : "你的名字")}</p><p className="text-xs text-muted">{isEmployer ? "企业主页 · 招聘联系人" : profile.resume?.discoverable ? "求职主页 · 可向雇主推荐" : "个人主页 · 仅对你选择的联系人可见"}</p></div></section>
        <section className="space-y-4" aria-labelledby="profile-basic">
          <h2 id="profile-basic" className="font-medium">{isEmployer ? "企业资料" : "基本资料"}</h2>
          <Field label={isEmployer ? "企业名称" : "称呼"} value={profile.name} onChange={(value) => update("name", value)} placeholder={isEmployer ? "企业或店铺名称" : "例如：林晓"} />
          {isEmployer && <Field label="招聘联系人" value={profile.contactName} onChange={(value) => update("contactName", value)} placeholder="例如：陈经理" />}
          <Field label={isEmployer ? "招聘简介" : "一句话介绍"} value={profile.headline} onChange={(value) => update("headline", value)} placeholder={isEmployer ? "例如：前厅、后厨招聘" : "例如：前厅服务 · 中英文沟通"} />
          <div className="grid gap-4 sm:grid-cols-2"><Field label={isEmployer ? "工作地址" : "所在地区"} value={profile.location} onChange={(value) => update("location", value)} placeholder={isEmployer ? "店铺地址" : "例如：奥克兰 · 北岸"} /><Field label="语言" value={profile.languages} onChange={(value) => update("languages", value)} placeholder="例如：普通话、英语" /></div>
          <Field label={isEmployer ? "联系时间" : "可工作时间"} value={profile.availability} onChange={(value) => update("availability", value)} placeholder={isEmployer ? "例如：工作日 10:00–17:00" : "例如：周一至周六，下午可上班"} />
          <div className="text-sm"><label htmlFor="profile-bio" className="mb-1 block font-medium">{isEmployer ? "企业介绍" : "个人介绍"}</label><textarea id="profile-bio" value={profile.bio} onChange={(event) => update("bio", event.target.value)} rows={4} placeholder={isEmployer ? "介绍企业、工作环境和团队…" : "介绍你的经验、擅长的工作和期望…"} className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" /></div>
        </section>
        <section className="border-t border-border pt-4"><h2 className="font-medium">资料预览</h2><div className="mt-3 space-y-2 rounded-lg border border-border bg-surface p-4"><p className="font-semibold">{profile.headline || "简介待填写"}</p>{isEmployer && <p className="text-sm">招聘联系人：{profile.contactName || "待填写"}</p>}<p className="text-sm text-muted">{profile.location || "地区待填写"} · {profile.languages || "语言待填写"}</p><p className="text-sm leading-relaxed">{profile.bio || (isEmployer ? "企业介绍待填写" : "个人介绍待填写")}</p><p className="text-xs text-muted">{profile.availability || (isEmployer ? "联系时间待填写" : "可工作时间待填写")}</p></div></section>
        {!isEmployer && <ResumeEditor value={profile.resume} onChange={(resume) => update("resume", resume)} />}
        <section className="space-y-4 border-t border-border pt-4" aria-labelledby="profile-private"><h2 id="profile-private" className="font-semibold">私密交换资料</h2><p className="text-xs text-muted">仅在双方同意交换后向聊天对方展示，不显示在公开主页。</p><div className="grid gap-4 sm:grid-cols-2">{([
          ["phone", "交换用电话", ""], ["wechat", "交换用微信", ""], ["email", "交换用邮箱", ""], ["address", "交换用地址", "填写愿意提供的面谈或联系地址"],
        ] as const).map(([key, label, placeholder]) => <Field key={key} label={label} value={profile.privateDetails?.[key] ?? ""} placeholder={placeholder} onChange={(value) => update("privateDetails", { phone: "", wechat: "", email: "", address: "", ...profile.privateDetails, [key]: value })} />)}</div></section>
        <div className="flex items-center justify-end gap-3"><span role="status" className="text-sm text-ok">{saved ? "已保存到本机" : ""}</span><button type="submit" className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white hover:opacity-90">保存资料</button></div>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="block text-sm"><span className="mb-1 block font-medium">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-11 w-full rounded-lg border border-border bg-background px-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" /></label>;
}

function Avatar({ text, large = false }: { text: string; large?: boolean }) {
  return <span aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand ${large ? "size-14 text-xl" : "size-9 text-sm"}`}>{text.slice(0, 1)}</span>;
}

function useSignedIn() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const session = useSession();
  const gate = (message: string) => <div className="rounded-lg border border-border bg-surface px-4 py-12 text-center"><p className="font-medium">{message}</p><Link href={`/login?next=${encodeURIComponent(pathname)}`} className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">登录 / 注册</Link></div>;
  return { signedIn: hydrated && Boolean(session), gate };
}
