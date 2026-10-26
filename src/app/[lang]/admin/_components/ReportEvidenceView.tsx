"use client";

import { useState } from "react";
import type { Refused } from "@/app/[lang]/admin/actions";
import { getReportEvidence } from "@/app/[lang]/admin/evidence-actions";
import { Loading } from "@/app/[lang]/admin/_components/Empty";
import { LoadFailed } from "@/app/[lang]/admin/_components/Failed";
import type { ReportEvidence } from "@/db/report-evidence";
import { useServerLoad } from "@/components/ui/use-server-load";
import { useLang, useMessages } from "@/i18n/client";
import { contentLang } from "@/i18n/lang";
import { formatDate } from "@/i18n/format";
import { adminViewsMessages } from "@/i18n/messages/admin-views";

// When a message was sent: day and time, New Zealand time (format.ts).
const TIME: Intl.DateTimeFormatOptions = { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" };

/**
 * One report's evidence (#353, ADR 0027 §3), behind a button: the queue knows only how much there is. Opening it
 * asks the server, which records the view (ADR 0026) before it answers; the messages read in the order they were
 * sent, each marked 举报人 or 雇主, then the screenshots.
 */
export function ReportEvidenceView({
  reportId,
  counts,
}: {
  reportId: string;
  counts: { messages: number; images: number };
}) {
  const t = useMessages(adminViewsMessages).evidence;
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2 text-foreground">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="pressable min-h-11 text-body font-medium text-brand underline underline-offset-4"
      >
        {open ? t.close : t.open(counts.messages, counts.images)}
      </button>
      {open && <Evidence reportId={reportId} />}
    </div>
  );
}

function Evidence({ reportId }: { reportId: string }) {
  const lang = useLang();
  const t = useMessages(adminViewsMessages).evidence;
  const { value, failed, reload } = useServerLoad<{ evidence: ReportEvidence[] } | Refused>(reportId, () =>
    getReportEvidence(reportId),
  );
  if (failed) return <LoadFailed what={t.name} onRetry={reload} />;
  if (!value) return <Loading cards={1} height="h-20" />;
  if ("refused" in value) return <p className="text-body text-muted">{value.error_zh}</p>;
  if (value.evidence.length === 0) return <p className="text-body text-muted">{t.none}</p>;
  const messages = value.evidence.flatMap((e) => (e.kind === "message" ? [e] : []));
  const images = value.evidence.flatMap((e) => (e.kind === "image" ? [e] : []));
  return (
    <div className="mt-1 space-y-3 rounded-control bg-surface p-3 ring-1 ring-border">
      <p className="text-meta text-muted">{t.note}</p>
      {messages.length > 0 && (
        <ol aria-label={t.messagesLabel} className="space-y-2">
          {messages.map((m) => (
            <li key={m.messageId} className="text-body">
              <span className="block text-meta text-muted">
                {m.from === "seeker" ? t.reporter : t.employer(m.byName)} ·{" "}
                <time dateTime={m.sentAt}>{formatDate(m.sentAt, lang, TIME)}</time>
              </span>
              <span lang={contentLang(m.text)} className="break-words whitespace-pre-line">
                {m.text}
              </span>
            </li>
          ))}
        </ol>
      )}
      {images.length > 0 && (
        <ul className="flex flex-wrap gap-3">
          {images.map((image, i) => (
            <li key={image.id}>
              <a href={image.url} target="_blank" rel="noopener noreferrer" aria-label={t.openImage(i + 1)}>
                {/* eslint-disable-next-line @next/next/no-img-element -- a moderator-only, uncached answer, not a page image */}
                <img
                  src={image.url}
                  alt={t.screenshot(i + 1)}
                  className="h-40 w-auto rounded-control border border-border object-contain"
                />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
