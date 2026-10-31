"use client";

import { useId, useState, type FormEvent } from "react";
import { Flag } from "lucide-react";
import { useChat, type Conversation } from "@/components/seeker/chat-client";
import { useSession } from "@/components/seeker/session-client";
import { CHAT_REPORT_NOTE_MAX, type ChatReportReason } from "@/lib/chat-report";
import { useLang, useMessages } from "@/i18n/client";
import { formatDate } from "@/i18n/format";
import { contentLang } from "@/i18n/lang";
import { chatMessages } from "@/i18n/messages/chat";
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
  const t = useMessages(chatMessages).report;
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={label ? undefined : t.buttonLabel}
        title={label ? undefined : t.buttonTitle}
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
  const words = useMessages(chatMessages);
  const t = words.report;
  const lang = useLang();
  const { messages, reports, reportConversation } = useChat();
  const isEmployer = useSession()?.activeRole === "employer";
  const [sent, setSent] = useState(false);
  const [reason, setReason] = useState<ChatReportReason | "">(presetReason ?? "");
  const [note, setNote] = useState("");
  const noteId = useId();
  const [range, setRange] = useState(messageIndex === undefined ? "" : String(messageIndex));
  const [error, setError] = useState("");
  const history = reports.filter((report) => report.conversationId === conversation.id);
  const thread = messages[conversation.id] ?? [];
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!reason) return setError(t.noReason);
    if (reason === "other" && !note.trim()) return setError(t.noNote);
    const ok = reportConversation(conversation.id, reason, note, range === "" ? undefined : Number(range));
    if (!ok) return setError(t.notSaved);
    setSent(true);
    toast(t.toast);
  }
  return (
    <ChatDialog title={t.dialogTitle} onClose={onClose}>
      {sent ? (
        <div className="space-y-3">
          <p role="status" className="font-medium text-ok">
            {t.sentTitle}
          </p>
          <p className="text-body text-muted">{t.sentNote}</p>
          <button type="button" className={CHAT_COMMAND_CLASS} onClick={onClose}>
            {t.close}
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {/* The other person's name is their own words, so it carries its own lang inside the line. */}
          <p className="text-body">
            {t.targetBefore}
            <span lang={contentLang(conversation.person)}>{conversation.person}</span>
            {t.targetAfter(isEmployer ? t.roleSeeker : t.roleEmployer)}
          </p>
          <Select
            name="report-reason"
            label={t.reasonLabel}
            placeholder={t.reasonPlaceholder}
            options={Object.entries(words.reportReasons).map(([value, label]) => ({ value, label }))}
            defaultValue={reason}
            onChange={(value) => {
              setReason(value as ChatReportReason | "");
              setError("");
            }}
          />
          <Select
            name="report-range"
            label={t.rangeLabel}
            placeholder={t.rangePlaceholder}
            options={thread.flatMap((message, index) =>
              message.from === "them"
                ? [{ value: String(index), label: t.messageOption(index + 1, message.text.slice(0, 60)) }]
                : [],
            )}
            defaultValue={range}
            onChange={setRange}
          />
          {range !== "" && (
            <p
              lang={contentLang(thread[Number(range)]?.text)}
              className="rounded-control bg-background px-3 py-2 text-body break-words whitespace-pre-line text-muted"
            >
              {thread[Number(range)]?.text}
            </p>
          )}
          {/* The label beside the box, not around it (design system, UI audit 1 #9). */}
          <div className="space-y-1 text-body">
            <label htmlFor={noteId} className="block text-meta text-muted">
              {reason === "other" ? t.noteRequired : t.noteOptional}
            </label>
            <textarea
              id={noteId}
              rows={3}
              maxLength={CHAT_REPORT_NOTE_MAX}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="w-full resize-y rounded-control border border-border bg-surface px-3 py-2 text-base focus:border-brand"
            />
          </div>
          {/* The note's length against its limit, as the job report's and the application's notes show it. */}
          <p className="text-right text-meta text-muted">
            {note.length} / {CHAT_REPORT_NOTE_MAX}
          </p>
          <p className="text-meta text-muted">{t.evidenceNote}</p>
          {error && (
            <p role="alert" className="text-body text-danger">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className={CHAT_COMMAND_CLASS} onClick={onClose}>
              {t.cancel}
            </button>
            <Button type="submit" variant="danger">
              {t.submit}
            </Button>
          </div>
          {history.length > 0 && (
            <details className="border-t border-border pt-3">
              <summary className="cursor-pointer text-sm text-muted">{t.history(history.length)}</summary>
              <ul className="mt-3 space-y-3">
                {history.map((report) => (
                  <li key={report.id} className="text-sm">
                    <p>{words.reportReasons[report.reason]}</p>
                    <p className="mt-1 break-words text-xs text-muted">
                      <span lang={contentLang(report.note)}>{report.note || t.noExtraNote}</span> ·{" "}
                      {formatDate(report.createdAt, lang, { year: "numeric", month: "numeric", day: "numeric" })}
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
