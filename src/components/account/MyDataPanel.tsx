"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteMyAccount, myServerData } from "@/app/[lang]/account/actions";
import { confirmsEmail, forgetLocalData, localDataFor, myDataFile, myDataFileName } from "@/components/account/my-data";
import { useHydrated, useSession } from "@/components/seeker/session-client";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { inputClass } from "@/components/ui/input-class";
import { useMessages } from "@/i18n/client";
import { accountMessages } from "@/i18n/messages/account";

/** Where deleting sends the browser: a full load, so nothing of the account stays in this page's memory. */
export const DELETED_HREF = "/account/data?deleted=1";

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** 数据与账号 (#54, R-30): download everything about the account, or delete it. Round 19: cards, red buttons. */
export function MyDataPanel() {
  const session = useSession();
  const t = useMessages(accountMessages).data;
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  if (!session) return null;
  const email = session.email;

  async function exportData() {
    setExporting(true);
    setExportResult(null);
    try {
      const answer = await myServerData();
      if (!answer.ok) return setExportResult({ ok: false, text: answer.error });
      const now = new Date();
      const file = myDataFile(answer.data, localDataFor(localStorage, email), now);
      download(myDataFileName(now), JSON.stringify(file, null, 2));
      setExportResult({ ok: true, text: t.exported(myDataFileName(now)) });
    } catch {
      setExportResult({ ok: false, text: t.exportFailed });
    } finally {
      setExporting(false);
    }
  }

  async function deleteAccount() {
    setDeleting(true);
    setDeleteError("");
    try {
      const answer = await deleteMyAccount(typed);
      if (!answer.ok) return setDeleteError(answer.error);
      forgetLocalData(localStorage, email);
      // A full load on purpose: the page's in-memory copies (chats, profile) must not outlive the account.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(DELETED_HREF);
    } catch {
      setDeleteError(t.deleteFailed);
    } finally {
      setDeleting(false);
    }
  }

  const confirmed = confirmsEmail(typed, email);

  return (
    <div className="space-y-section">
      <Section look="sheet" id="export-data" title={t.exportTitle} description={t.exportDescription}>
        <div className="space-y-3 py-group">
          <p className="text-meta text-muted">{t.exportDeviceNote}</p>
          <Button variant="secondary" onClick={() => void exportData()} loading={exporting}>
            {exporting ? t.exporting : t.exportButton}
          </Button>
          {exportResult && (
            <p role="status" className={`text-meta ${exportResult.ok ? "text-ok" : "text-danger"}`}>
              {exportResult.text}
            </p>
          )}
        </div>
      </Section>

      <Section look="sheet" id="delete-account" title={t.deleteTitle}>
        <form
          className="space-y-3 py-group"
          onSubmit={(e) => {
            e.preventDefault();
            if (confirmed && !deleting) void deleteAccount();
          }}
        >
          <ul className="list-disc space-y-1 pl-5 text-body">
            {t.deleteWhat.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <label className="block space-y-1">
            <span className="text-body">
              {t.confirmBefore} <span className="font-medium break-all">{email}</span> {t.confirmAfter}
            </span>
            <input
              type="email"
              inputMode="email"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              aria-invalid={deleteError ? true : undefined}
              aria-describedby={deleteError ? "delete-account-error" : undefined}
              className={inputClass({ tone: deleteError ? "danger" : undefined })}
            />
          </label>
          {deleteError && (
            <p
              id="delete-account-error"
              role="alert"
              className="rounded-control bg-danger-soft px-3 py-2 text-body text-danger"
            >
              {deleteError}
            </p>
          )}
          <Button type="submit" variant="danger" disabled={!confirmed} loading={deleting}>
            {deleting ? t.deleting : t.deleteButton}
          </Button>
        </form>
      </Section>
    </div>
  );
}

/** After 删除账号: says what happened. Someone signed in who opens the address gets the normal page instead. */
export function AccountDeleted() {
  const router = useRouter();
  const t = useMessages(accountMessages).data;
  const hydrated = useHydrated();
  const session = useSession();
  useEffect(() => {
    if (hydrated && session) router.replace("/account/data");
  }, [hydrated, session, router]);
  return (
    <Section look="sheet">
      <div role="status" className="space-y-2 py-group">
        <p className="text-title font-semibold">{t.deleted}</p>
        <p className="text-body">{t.deletedText}</p>
        <ButtonLink href="/jobs" className="mt-2">
          {t.seeJobs}
        </ButtonLink>
      </div>
    </Section>
  );
}
