"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import type { AdminResult, Refused } from "@/app/[lang]/admin/actions";
import { isFailed, settle, type Failed } from "@/app/[lang]/admin/load-state";
import { approvePhoto, getPhotoQueue, rejectPhoto, type PhotoItem } from "@/app/[lang]/admin/photo-actions";
import { Empty, Loading } from "@/app/[lang]/admin/_components/Empty";
import { LoadFailed, TryAgain } from "@/app/[lang]/admin/_components/Failed";
import { useAdminLoad } from "@/app/[lang]/admin/_components/use-admin-load";
import { PHOTO_REJECT_REASONS, type PhotoRejectReason } from "@/lib/company-photos";
import { useLang, useMessages } from "@/i18n/client";
import { contentLang } from "@/i18n/lang";
import { formatDate } from "@/i18n/format";
import { employerPhotosMessages } from "@/i18n/messages/employer-photos";
import { Button } from "@/components/ui/Button";
import { sheetClass } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";

// When a photo was uploaded: day and time, New Zealand time (format.ts).
const TIME: Intl.DateTimeFormatOptions = { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" };

/**
 * The shop photos waiting (ADR 0052), loaded again whenever `version` changes. Asked on every visit, not only on its
 * tab: the list is names and times (the pictures load when the tab shows them), and 待处理's count needs it.
 */
export function usePhotoQueue(version: number) {
  return useAdminLoad<PhotoItem[] | Refused>(getPhotoQueue, version);
}

/** 门店照片 (F8, ADR 0052): each waiting photo with its business, to approve or send back with a reason. */
export function PhotoQueue({
  queue,
  onDone,
  onRetry,
}: {
  queue?: PhotoItem[] | Refused | Failed;
  onDone: (result: AdminResult) => void;
  onRetry: () => void;
}) {
  const t = useMessages(employerPhotosMessages).admin;
  if (isFailed(queue)) return <LoadFailed what={t.listName} onRetry={onRetry} />;
  if (!queue) return <Loading />;
  if ("refused" in queue) return <Empty>{queue.error_zh}</Empty>;
  if (queue.length === 0) return <Empty>{t.empty}</Empty>;
  return (
    <ul className="space-y-3">
      {queue.map((photo) => (
        <li key={photo.id}>
          <PhotoCard photo={photo} onDone={onDone} />
        </li>
      ))}
    </ul>
  );
}

function PhotoCard({ photo, onDone }: { photo: PhotoItem; onDone: (result: AdminResult) => void }) {
  const lang = useLang();
  const messages = useMessages(employerPhotosMessages);
  const t = messages.admin;
  const [reason, setReason] = useState<PhotoRejectReason>();
  const [pending, startTransition] = useTransition();
  // Which button was pressed, so only that one shows it is on its way.
  const [pressed, setPressed] = useState<"approve" | "reject">();
  const [failed, setFailed] = useState(false); // #183: no answer came; the chosen reason stays
  const run = (key: "approve" | "reject", action: () => Promise<AdminResult>) => {
    setPressed(key);
    setFailed(false);
    startTransition(async () => {
      const result = await settle(action);
      if (result) onDone(result);
      else setFailed(true);
    });
  };
  const busy = (key: "approve" | "reject") => pending && pressed === key;
  const another = (key: "approve" | "reject") => pending && pressed !== key;
  const shop = photo.employerName;

  return (
    <article aria-label={t.card(shop)} className={`space-y-3 ${sheetClass()}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 lang={contentLang(shop)} className="text-subtitle font-semibold">
          <Link href={`/employers/${encodeURIComponent(photo.employerId)}`} className="text-brand hover:underline">
            {shop}
          </Link>
        </h2>
        <span className="text-meta text-muted">{t.uploaded(formatDate(photo.uploadedAt, lang, TIME))}</span>
      </div>
      {/* The route checks the moderator again and sends no-store for a waiting photo (ADR 0052 §2). */}
      {/* eslint-disable-next-line @next/next/no-img-element -- a private photo, not something to optimise */}
      <img
        src={`/api/company-photos/${encodeURIComponent(photo.id)}`}
        alt={t.photoAlt(shop)}
        loading="lazy"
        className="max-h-96 w-full rounded-control bg-background object-contain"
      />
      <div className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
        <Button
          variant="secondary"
          disabled={another("approve")}
          loading={busy("approve")}
          onClick={() => run("approve", () => approvePhoto(photo.id))}
        >
          {t.approve}
        </Button>
        <div className="w-full max-w-xs">
          <Select
            label={t.reason}
            placeholder={t.choose}
            options={PHOTO_REJECT_REASONS.map((r) => ({ value: r, label: messages.rejectReasons[r] }))}
            value={reason ?? ""}
            onChange={(value) => setReason((value || undefined) as PhotoRejectReason | undefined)}
          />
        </div>
        <Button
          variant="danger-secondary"
          disabled={!reason || another("reject")}
          loading={busy("reject")}
          onClick={() => run("reject", () => rejectPhoto(photo.id, reason))}
        >
          {t.reject}
        </Button>
      </div>
      {failed && <TryAgain />}
    </article>
  );
}
