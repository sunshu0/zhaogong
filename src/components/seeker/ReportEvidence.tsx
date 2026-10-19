"use client";

import { Fragment } from "react";
import { X } from "lucide-react";
import { reportableMessages } from "@/app/[lang]/jobs/[id]/actions";
import { RetryLine } from "@/components/seeker/RetryLine";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { useServerLoad } from "@/components/ui/use-server-load";
import { useLang, useMessages } from "@/i18n/client";
import { formatDate } from "@/i18n/format";
import { contentLang } from "@/i18n/lang";
import { seekerJobsMessages } from "@/i18n/messages/seeker-jobs";
import {
  EVIDENCE_IMAGE_BYTES_MAX,
  EVIDENCE_IMAGE_TYPES,
  EVIDENCE_IMAGES_MAX,
  EVIDENCE_KEEP_DAYS,
  EVIDENCE_MESSAGES_MAX,
} from "@/lib/report-evidence";

/**
 * 附上聊天记录 in the job report (ADR 0027): the signed-in reporter's messages with the job's business, oldest first
 * and grouped by chat, to tick up to EVIDENCE_MESSAGES_MAX. Nothing shows signed out or with no such chat.
 */
export function ReportEvidence({
  jobId,
  account,
  picked,
  onChange,
}: {
  jobId: string;
  /** The signed-in account; the list is asked again for another. */
  account: string;
  picked: readonly number[];
  onChange: (ids: number[]) => void;
}) {
  const lang = useLang();
  const t = useMessages(seekerJobsMessages).report.evidence;
  const { value, failed, reload } = useServerLoad(`${account} ${jobId}`, () => reportableMessages(jobId));
  if (failed) return <RetryLine text={t.notLoaded} onRetry={reload} className="mt-3" />;
  if (value === undefined) return <p className="mt-3 text-meta text-muted">{t.loading}</p>;
  if (!value?.length) return null;
  const full = picked.length >= EVIDENCE_MESSAGES_MAX;
  const when = (at: string) =>
    formatDate(at, lang, { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" });
  return (
    <fieldset className="mt-3">
      <legend className="text-sm">{t.legend}</legend>
      <p className="mt-1 text-meta text-muted">{t.hint(EVIDENCE_MESSAGES_MAX, EVIDENCE_KEEP_DAYS)}</p>
      <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto rounded-control border border-border p-2">
        {value.map((m, i) => {
          const checked = picked.includes(m.id);
          return (
            <Fragment key={m.id}>
              {m.jobTitle !== value[i - 1]?.jobTitle && (
                <li className="pt-1 text-meta text-muted">
                  {t.about}
                  <span lang={contentLang(m.jobTitle)}>{m.jobTitle}</span>
                </li>
              )}
              <li>
                <Checkbox
                  checked={checked}
                  disabled={!checked && full}
                  onChange={() => onChange(checked ? picked.filter((id) => id !== m.id) : [...picked, m.id])}
                >
                  <span className="block text-meta text-muted">
                    {m.mine ? t.me : <span lang={contentLang(m.byName)}>{m.byName || t.employer}</span>} ·{" "}
                    {when(m.sentAt)}
                  </span>
                  <span lang={contentLang(m.text)} className="block text-body break-words whitespace-pre-wrap">
                    {m.text}
                  </span>
                </Checkbox>
              </li>
            </Fragment>
          );
        })}
      </ul>
      <p className="mt-1 text-right text-meta text-muted" aria-live="polite">
        {t.count(picked.length, EVIDENCE_MESSAGES_MAX)}
      </p>
    </fieldset>
  );
}

const MB = EVIDENCE_IMAGE_BYTES_MAX / 1024 / 1024;

/**
 * 附上截图 in the job report (ADR 0027 §2): up to EVIDENCE_IMAGES_MAX files, checked here by type and size as they are
 * chosen (the server checks them again by their bytes and takes their metadata off). Signed in only, like the
 * messages: the screenshots go with the reporter's account.
 */
export function ReportImages({
  files,
  onChange,
  onError,
}: {
  files: readonly File[];
  onChange: (files: File[]) => void;
  onError: (error: string | null) => void;
}) {
  const t = useMessages(seekerJobsMessages).report.evidence;
  return (
    <fieldset className="mt-3">
      <legend className="text-sm">{t.imagesLegend}</legend>
      <p className="mt-1 text-meta text-muted">{t.imagesHint(EVIDENCE_IMAGES_MAX, MB)}</p>
      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((file, i) => (
            <li key={`${file.name} ${i}`} className="flex items-center gap-2 text-body">
              <span lang={contentLang(file.name)} className="min-w-0 flex-1 truncate">
                {file.name}
              </span>
              <span className="shrink-0 text-meta text-muted tabular-nums">
                {Math.max(0.1, file.size / 1024 / 1024).toFixed(1)} MB
              </span>
              <Button variant="link" onClick={() => onChange(files.filter((_, j) => j !== i))}>
                <span className="sr-only">{t.removeImage(file.name)}</span>
                <X aria-hidden="true" className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {files.length < EVIDENCE_IMAGES_MAX && (
        <input
          type="file"
          accept={EVIDENCE_IMAGE_TYPES.join(",")}
          multiple
          aria-label={t.chooseImages}
          onChange={(event) => {
            const chosen = [...(event.currentTarget.files ?? [])];
            event.currentTarget.value = "";
            const all = [...files, ...chosen];
            if (all.length > EVIDENCE_IMAGES_MAX) return onError(t.tooManyImages(EVIDENCE_IMAGES_MAX));
            if (!chosen.every((file) => (EVIDENCE_IMAGE_TYPES as readonly string[]).includes(file.type)))
              return onError(t.notImage);
            if (chosen.some((file) => file.size > EVIDENCE_IMAGE_BYTES_MAX)) return onError(t.imageTooBig(MB));
            onError(null);
            onChange(all);
          }}
          className="mt-2 block w-full text-body text-muted file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-control file:border file:border-border file:bg-surface file:px-4 file:text-body file:font-medium file:text-foreground"
        />
      )}
    </fieldset>
  );
}
