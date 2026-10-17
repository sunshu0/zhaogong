"use client";

import { useState, type FormEvent } from "react";
import { Flag } from "lucide-react";
import { useChat, type Conversation } from "@/components/seeker/chat-client";
import { useSession } from "@/components/seeker/session-client";
import { CHAT_REPORT_REASONS, type ChatReportReason } from "@/lib/chat-report";
import { ChatDialog, CHAT_COMMAND_CLASS } from "@/components/seeker/ChatDialog";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/ui/Toast";

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
            ? "pressable inline-flex min-h-11 items-center text-body font-medium text-danger underline underline-offset-2"
            : "pressable flex size-11 shrink-0 items-center justify-center rounded-full text-danger hover:bg-danger-soft"
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
    toast("举报已记录");
  }
  return (
    <ChatDialog title="举报聊天对方" onClose={onClose}>
      {sent ? (
        <div className="space-y-3">
          <p role="status" className="font-medium text-ok">
            举报已记录
          </p>
          <p className="text-body text-muted">前端演示：举报及聊天证据已保存到本机，尚未送交平台处理；不会通知对方。</p>
          <button type="button" className={CHAT_COMMAND_CLASS} onClick={onClose}>
            关闭
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <p className="text-body">
            举报对象：{conversation.person} · {isEmployer ? "求职者" : "雇主"}
          </p>
          <Select
            name="report-reason"
            label="举报原因"
            placeholder="请选择"
            options={Object.entries(CHAT_REPORT_REASONS).map(([value, label]) => ({ value, label }))}
            defaultValue={reason}
            onChange={(value) => {
              setReason(value as ChatReportReason | "");
              setError("");
            }}
          />
          <Select
            name="report-range"
            label="举报范围"
            placeholder="整段聊天（最近 100 条）"
            options={thread.flatMap((message, index) =>
              message.from === "them"
                ? [{ value: String(index), label: `${index + 1}. ${message.text.slice(0, 60)}` }]
                : [],
            )}
            defaultValue={range}
            onChange={setRange}
          />
          {range !== "" && (
            <p className="rounded-control bg-background px-3 py-2 text-body break-words whitespace-pre-line text-muted">
              {thread[Number(range)]?.text}
            </p>
          )}
          <label className="block space-y-1 text-body">
            <span className="block text-meta text-muted">补充说明{reason === "other" ? "（必填）" : "（选填）"}</span>
            <textarea
              rows={3}
              maxLength={1000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="w-full resize-y rounded-control border border-border bg-surface px-3 py-2 text-base focus:border-brand"
            />
          </label>
          <p className="text-meta text-muted">举报会附带所选聊天内容，仅用于处理举报。前端演示记录保存在本机。</p>
          {error && (
            <p role="alert" className="text-body text-danger">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className={CHAT_COMMAND_CLASS} onClick={onClose}>
              取消
            </button>
            <Button type="submit" variant="danger">
              提交举报
            </Button>
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
