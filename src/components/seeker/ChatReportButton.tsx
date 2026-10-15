"use client";

import { useState, type FormEvent } from "react";
import { Flag } from "lucide-react";
import { useChat, type Conversation } from "@/components/seeker/chat-client";
import { useSession } from "@/components/seeker/session-client";
import { CHAT_REPORT_REASONS, type ChatReportReason } from "@/lib/chat-report";
import { ChatDialog, CHAT_COMMAND_CLASS } from "@/components/seeker/ChatDialog";

/**
 * 举报聊天. With `messageIndex` and `label` it is a text button under one received message (a compliance
 * reminder) that opens the same dialog with that message and `reason` already chosen.
 */
export function ChatReportButton({
  conversation,
  messageIndex,
  reason,
  label,
}: {
  conversation: Conversation;
  messageIndex?: number;
  reason?: ChatReportReason;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={label ? undefined : "举报聊天"}
        title={label ? undefined : "举报聊天对方"}
        onClick={() => setOpen(true)}
        className={
          label
            ? "inline-flex min-h-11 items-center text-sm font-medium text-danger underline underline-offset-2"
            : "flex size-11 shrink-0 items-center justify-center rounded-lg text-danger hover:bg-danger-soft"
        }
      >
        {label ?? <Flag aria-hidden="true" className="size-5" />}
      </button>
      {open && (
        <ChatReportDialog
          conversation={conversation}
          messageIndex={messageIndex}
          reason={reason}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/** The report form for one conversation; starts fresh each time it opens. */
export function ChatReportDialog({
  conversation,
  messageIndex,
  reason: presetReason,
  onClose,
}: {
  conversation: Conversation;
  messageIndex?: number;
  reason?: ChatReportReason;
  onClose: () => void;
}) {
  const { messages, reports, reportConversation } = useChat();
  const isEmployer = useSession()?.activeRole === "employer";
  const [sent, setSent] = useState(false);
  const [reason, setReason] = useState<ChatReportReason | "">(presetReason ?? "");
  const [note, setNote] = useState("");
  const [range, setRange] = useState(messageIndex === undefined ? "" : String(messageIndex));
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
  return (
    <ChatDialog title="举报聊天对方" onClose={onClose}>
      {sent ? (
        <div className="space-y-3">
          <p role="status" className="font-medium text-ok">
            举报已记录
          </p>
          <p className="text-sm text-muted">前端演示：举报及聊天证据已保存到本机，尚未送交平台处理；不会通知对方。</p>
          <button type="button" className={CHAT_COMMAND_CLASS} onClick={onClose}>
            关闭
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <p className="text-sm">
            举报对象：{conversation.person} · {isEmployer ? "求职者" : "雇主"}
          </p>
          <label className="block text-sm">
            举报原因
            <select
              aria-label="举报原因"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value as ChatReportReason);
                setError("");
              }}
              className="mt-1 h-11 w-full rounded-lg border border-border bg-surface px-3"
            >
              <option value="">请选择</option>
              {Object.entries(CHAT_REPORT_REASONS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            举报范围
            <select
              aria-label="举报范围"
              value={range}
              onChange={(event) => setRange(event.target.value)}
              className="mt-1 h-11 w-full rounded-lg border border-border bg-surface px-3"
            >
              <option value="">整段聊天（最近 100 条）</option>
              {thread.map((message, index) =>
                message.from === "them" ? (
                  <option key={index} value={index}>
                    {index + 1}. {message.text.slice(0, 60)}
                  </option>
                ) : null,
              )}
            </select>
          </label>
          {range !== "" && (
            <p className="whitespace-pre-line break-words border-l-2 border-border pl-3 text-sm text-muted">
              {thread[Number(range)]?.text}
            </p>
          )}
          <label className="block text-sm">
            补充说明{reason === "other" ? "（必填）" : "（选填）"}
            <textarea
              rows={3}
              maxLength={1000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="mt-1 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-base"
            />
          </label>
          <p className="text-xs text-muted">举报会附带所选聊天内容，仅用于处理举报。前端演示记录保存在本机。</p>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className={CHAT_COMMAND_CLASS} onClick={onClose}>
              取消
            </button>
            <button type="submit" className="min-h-11 rounded-lg bg-danger px-4 text-sm font-medium text-white">
              提交举报
            </button>
          </div>
          {history.length > 0 && (
            <details className="border-t border-border pt-3">
              <summary className="cursor-pointer text-sm text-muted">本机举报记录（{history.length}）</summary>
              <ul className="mt-3 space-y-3">
                {history.map((report) => (
                  <li key={report.id} className="text-sm">
                    <p>{CHAT_REPORT_REASONS[report.reason]}</p>
                    <p className="mt-1 break-words text-xs text-muted">
                      {report.note || "未补充说明"} · {new Date(report.createdAt).toLocaleDateString("zh-CN")}
                    </p>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </form>
      )}
    </ChatDialog>
  );
}
