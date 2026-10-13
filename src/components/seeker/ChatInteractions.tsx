"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Contact, FileText, Flag, MapPin, X } from "lucide-react";
import { useChat, type Conversation } from "@/components/seeker/chat-client";
import { useProfile } from "@/components/seeker/hub-client";
import { useSession } from "@/components/seeker/session-client";
import { EXCHANGE_LABELS, profilePayload, visibleExchange, type Exchange, type ExchangeKind, type ExchangePayload } from "@/lib/chat-consent";
import { CHAT_REPORT_REASONS, type ChatReportReason } from "@/lib/chat-report";

const command = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:border-brand disabled:cursor-default disabled:opacity-60";

function ChatDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => { dialog?.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={ref} aria-labelledby={heading} onCancel={(event) => { event.preventDefault(); onClose(); }} className="m-auto max-h-[85dvh] w-[min(34rem,calc(100vw_-_2rem))] overflow-y-auto rounded-lg border border-border bg-surface p-0 text-foreground backdrop:bg-black/40">
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3"><h2 id={heading} className="text-lg font-semibold">{title}</h2><button type="button" onClick={onClose} aria-label="关闭弹窗" title="关闭" className="flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-background"><X aria-hidden="true" className="size-5" /></button></div>
    <div className="space-y-4 p-4">{children}</div>
  </dialog>;
}

function PayloadView({ payload }: { payload: ExchangePayload }) {
  return <dl className="space-y-2 text-sm">{payload.fields.map((field, index) => <div key={`${field.label}-${index}`}><dt className="text-xs text-muted">{field.label}</dt><dd className="mt-1 whitespace-pre-line break-words">{field.value}</dd></div>)}</dl>;
}

function ExchangeAction({ conversationId, kind, incoming, children }: { conversationId: string; kind: ExchangeKind; incoming?: Exchange; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { profile } = useProfile();
  const isEmployer = useSession()?.activeRole === "employer";
  const { requestInfo, respondInfo } = useChat();
  const payload = profilePayload(profile, kind, isEmployer);
  return <><button type="button" onClick={() => setOpen(true)} className={command}>{children}</button>{open && <ChatDialog title={incoming ? `同意交换${EXCHANGE_LABELS[kind]}` : `申请交换${EXCHANGE_LABELS[kind]}`} onClose={() => setOpen(false)}>
    <p className="text-sm leading-relaxed">{incoming ? "同意后，你和对方将同时获得彼此本次交换的资料。" : "对方同意后，你和对方将同时获得彼此本次交换的资料。"}</p>
    <section aria-label="我的交换内容" className="space-y-3 border-y border-border py-4"><h3 className="text-sm font-semibold">本次将交换的我的资料</h3>{payload ? <PayloadView payload={payload} /> : <p className="text-sm text-muted">尚未填写可交换的{EXCHANGE_LABELS[kind]}。</p>}<Link href="/profile" className="inline-flex min-h-11 items-center text-sm text-brand underline">编辑我的资料</Link></section>
    <p className="text-xs leading-relaxed text-muted">同意交换后，对方可能保存这些资料。拒绝或撤回请求不会交换任何资料。</p>
    <div className="flex flex-wrap justify-end gap-2"><button type="button" className={command} onClick={() => setOpen(false)}>取消</button><button type="button" disabled={!payload} onClick={() => {
      if (!payload) return;
      if (incoming) respondInfo(conversationId, incoming.id, "accepted", payload);
      else requestInfo(conversationId, kind, payload);
      setOpen(false);
    }} className="min-h-11 rounded-lg bg-brand px-4 text-sm font-medium text-white disabled:opacity-50">{incoming ? "同意并交换双方资料" : "发送交换请求"}</button></div>
  </ChatDialog>}</>;
}

const TOOLS = [
  { kind: "resume" as const, label: "交换资料", icon: FileText },
  { kind: "contact" as const, label: "交换联系方式", icon: Contact },
  { kind: "address" as const, label: "交换地址", icon: MapPin },
];

export function ChatExchangeTools({ conversationId }: { conversationId: string }) {
  const { exchanges } = useChat();
  const items = exchanges[conversationId] ?? [];
  return <div className="mb-3 flex flex-wrap gap-2" aria-label="沟通工具">{TOOLS.map(({ kind, label, icon: Icon }) => {
    const current = items.find((item) => item.kind === kind && ["pending", "accepted"].includes(item.status));
    return <span key={kind}>{current && (current.status === "accepted" || current.from === "me") ? <button type="button" disabled className={command}><Icon aria-hidden="true" className="size-4" />{label}<span className="text-xs">{current.status === "accepted" ? "已交换" : "待同意"}</span></button> : <ExchangeAction conversationId={conversationId} kind={kind} incoming={current}><Icon aria-hidden="true" className="size-4" />{label}</ExchangeAction>}</span>;
  })}</div>;
}

export function ChatExchangeList({ conversationId }: { conversationId: string }) {
  const { exchanges, respondInfo } = useChat();
  const items = exchanges[conversationId] ?? [];
  return <>{items.map((item) => {
    const visible = visibleExchange(item);
    return <section key={item.id} aria-label={`${EXCHANGE_LABELS[item.kind]}交换请求`} className="mx-auto max-w-2xl space-y-3 rounded-lg border border-border bg-surface p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{item.from === "me" ? "你申请" : "对方申请"}交换{EXCHANGE_LABELS[item.kind]}</h3>{item.demo && <span className="text-xs text-muted">演示请求</span>}</div>
      {item.status === "pending" && <><p className="text-xs leading-relaxed text-muted">{item.from === "me" ? "等待对方同意，双方资料尚未交换。" : "双方同意后才会交换资料，你可以拒绝。"}</p><div className="flex flex-wrap gap-2">{item.from === "me" ? <button type="button" className={command} onClick={() => respondInfo(conversationId, item.id, "cancelled")}>撤回请求</button> : <><ExchangeAction conversationId={conversationId} kind={item.kind} incoming={item}>查看并同意</ExchangeAction><button type="button" className={command} onClick={() => respondInfo(conversationId, item.id, "rejected")}>拒绝交换</button></>}</div></>}
      {item.status === "rejected" && <p className="text-muted">{item.from === "me" ? "对方已拒绝" : "你已拒绝"}，双方资料未交换。</p>}
      {item.status === "cancelled" && <p className="text-muted">请求已撤回，双方资料未交换。</p>}
      {visible && <><p className="text-ok">双方已同意，资料已交换。</p><div className="grid gap-4 border-t border-border pt-3 sm:grid-cols-2"><div className="space-y-2"><h4 className="font-medium">对方的资料</h4><PayloadView payload={visible.them} /></div><div className="space-y-2"><h4 className="font-medium">我的资料</h4><PayloadView payload={visible.me} /></div></div></>}
    </section>;
  })}</>;
}

export function ChatReportButton({ conversation }: { conversation: Conversation }) {
  const { messages, reports, reportConversation } = useChat();
  const isEmployer = useSession()?.activeRole === "employer";
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [reason, setReason] = useState<ChatReportReason | "">("");
  const [note, setNote] = useState("");
  const [range, setRange] = useState("");
  const [error, setError] = useState("");
  const history = reports.filter((report) => report.conversationId === conversation.id);
  const thread = messages[conversation.id] ?? [];
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!reason) return setError("请选择举报原因");
    if (reason === "other" && !note.trim()) return setError("请补充说明具体问题");
    const ok = reportConversation(conversation.id, reason, note, range === "" ? undefined : Number(range));
    if (!ok) return setError("举报未保存，请重试");
    setSent(true);
  }
  return <><button type="button" aria-label="举报聊天" title="举报聊天对方" onClick={() => { setOpen(true); setSent(false); setError(""); setReason(""); setNote(""); setRange(""); }} className="flex size-11 shrink-0 items-center justify-center rounded-lg text-danger hover:bg-danger-soft"><Flag aria-hidden="true" className="size-5" /></button>
    {open && <ChatDialog title="举报聊天对方" onClose={() => setOpen(false)}>{sent ? <div className="space-y-3"><p role="status" className="font-medium text-ok">举报已记录</p><p className="text-sm text-muted">前端演示：举报及聊天证据已保存到本机，尚未送交平台处理；不会通知对方。</p><button type="button" className={command} onClick={() => setOpen(false)}>关闭</button></div> : <form onSubmit={submit} className="space-y-4" noValidate>
      <p className="text-sm">举报对象：{conversation.person} · {isEmployer ? "求职者" : "雇主"}</p>
      <label className="block text-sm">举报原因<select aria-label="举报原因" value={reason} onChange={(event) => { setReason(event.target.value as ChatReportReason); setError(""); }} className="mt-1 h-11 w-full rounded-lg border border-border bg-surface px-3"><option value="">请选择</option>{Object.entries(CHAT_REPORT_REASONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="block text-sm">举报范围<select aria-label="举报范围" value={range} onChange={(event) => setRange(event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-border bg-surface px-3"><option value="">整段聊天（最近 100 条）</option>{thread.map((message, index) => message.from === "them" ? <option key={index} value={index}>{index + 1}. {message.text.slice(0, 60)}</option> : null)}</select></label>
      {range !== "" && <p className="whitespace-pre-line break-words border-l-2 border-border pl-3 text-sm text-muted">{thread[Number(range)]?.text}</p>}
      <label className="block text-sm">补充说明{reason === "other" ? "（必填）" : "（选填）"}<textarea rows={3} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-base" /></label>
      <p className="text-xs text-muted">举报会附带所选聊天内容，仅用于处理举报。前端演示记录保存在本机。</p>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex justify-end gap-2"><button type="button" className={command} onClick={() => setOpen(false)}>取消</button><button type="submit" className="min-h-11 rounded-lg bg-danger px-4 text-sm font-medium text-white">提交举报</button></div>
      {history.length > 0 && <details className="border-t border-border pt-3"><summary className="cursor-pointer text-sm text-muted">本机举报记录（{history.length}）</summary><ul className="mt-3 space-y-3">{history.map((report) => <li key={report.id} className="text-sm"><p>{CHAT_REPORT_REASONS[report.reason]}</p><p className="mt-1 break-words text-xs text-muted">{report.note || "未补充说明"} · {new Date(report.createdAt).toLocaleDateString("zh-CN")}</p></li>)}</ul></details>}
    </form>}</ChatDialog>}
  </>;
}
