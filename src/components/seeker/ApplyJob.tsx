"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Send } from "lucide-react";
import {
  applyForJob,
  myJobApplication,
  withdrawMyApplication,
  type MyApplication,
} from "@/app/[lang]/jobs/[id]/apply-actions";
import { refreshApplied, useAppliedJobIds } from "@/components/seeker/applied-client";
import {
  APPLY_PARAM,
  NOTE_MAX,
  applicantCandidate,
  applicationProfileFrom,
  applyAfterSignInHref,
} from "@/components/seeker/applications";
import { useProfile } from "@/components/seeker/hub-client";
import { useHydrated, useSession } from "@/components/seeker/session-client";
import { inputClass } from "@/components/ui/input-class";
import { buttonClass, type ButtonSize } from "@/components/ui/Button";
import { busyProps } from "@/components/ui/busy";
import { contentLang } from "@/i18n/lang";
import { useLang, useMessages } from "@/i18n/client";
import { seekerJobsMessages } from "@/i18n/messages/seeker-jobs";
import { candidateFacts } from "@/lib/candidate-matching";

/**
 * 申请 on a job page (#84): the job seeker sends their page (as employers see it, no contact details) and a note of
 * up to 200 characters. Signed out, it goes to sign-in and comes back with ?apply=1, which opens the form. Once
 * applied it shows how far the application got, and can be withdrawn. Not shown on closed jobs, to employers or
 * for the account's own business.
 */
export function ApplyJob({
  jobId,
  jobTitle,
  employerId,
  size = "md",
}: {
  jobId: string;
  jobTitle: string;
  employerId: string;
  /** "lg" in the job page's action bar (Round 19), where 申请 is the secondary action. */
  size?: ButtonSize;
}) {
  const applyButton = `${buttonClass("secondary", { size })} whitespace-nowrap`;
  const t = useMessages(seekerJobsMessages).apply;
  const hydrated = useHydrated();
  const session = useSession();
  const router = useRouter();
  const [mine, setMine] = useState<MyApplication | null | undefined>(undefined);
  // The lookup of this account's application got no answer (#250): 申请 asks again instead of staying disabled.
  const [failed, setFailed] = useState(false);
  const [lookup, setLookup] = useState(0);
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const seeker = Boolean(session && session.activeRole === "seeker" && session.employerId !== employerId);

  useEffect(() => {
    if (!seeker) return;
    let current = true;
    myJobApplication(jobId)
      .then((answer) => {
        if (!current) return;
        setMine(answer);
        // Back from sign-in (applyAfterSignInHref): open the form once, and take the flag out of the address.
        const url = new URL(location.href);
        if (!url.searchParams.has(APPLY_PARAM)) return;
        url.searchParams.delete(APPLY_PARAM);
        router.replace(`${url.pathname}${url.search}`, { scroll: false });
        if (!answer) setOpen(true);
      })
      .catch(() => current && setFailed(true));
    return () => {
      current = false;
    };
  }, [seeker, jobId, router, lookup]);

  if (!hydrated || !session)
    return (
      <Link href={applyAfterSignInHref(jobId)} className={applyButton}>
        <Send aria-hidden="true" className="size-4" />
        {t.apply}
      </Link>
    );
  if (!seeker) return null;

  if (failed)
    return (
      <>
        <span role="alert" className="sr-only">
          {t.checkFailed}
        </span>
        <button
          type="button"
          title={t.checkFailed}
          onClick={() => {
            setFailed(false);
            setLookup((n) => n + 1);
          }}
          className={applyButton}
        >
          <Send aria-hidden="true" className="size-4" />
          {t.checkAgain}
        </button>
      </>
    );

  return (
    <>
      <button
        ref={opener}
        type="button"
        disabled={mine === undefined}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={applyButton}
      >
        <Send aria-hidden="true" className="size-4" />
        {mine ? t.appliedWithStatus(mine.status) : t.apply}
      </button>
      {open && (
        <ApplyDialog
          jobId={jobId}
          jobTitle={jobTitle}
          mine={mine ?? null}
          onChange={(next) => {
            setMine(next);
            refreshApplied();
          }}
          onClose={() => {
            setOpen(false);
            opener.current?.focus(); // the dialog goes away: back to 申请 (#202)
          }}
        />
      )}
    </>
  );
}

function ApplyDialog({
  jobId,
  jobTitle,
  mine,
  onChange,
  onClose,
}: {
  jobId: string;
  jobTitle: string;
  mine: MyApplication | null;
  onChange: (next: MyApplication | null) => void;
  onClose: () => void;
}) {
  const { profile } = useProfile();
  const t = useMessages(seekerJobsMessages).apply;
  const lang = useLang();
  const page = applicationProfileFrom(profile);
  const facts = page ? candidateFacts(applicantCandidate("me", page), lang) : [];
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const titleId = useId();
  const first = useRef<HTMLTextAreaElement & HTMLButtonElement>(null);

  useEffect(() => {
    first.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function submit() {
    setBusy(true);
    setError("");
    const result = await applyForJob(jobId, note, page).catch(() => null);
    setBusy(false);
    if (!result) return setError(t.networkError);
    if (!result.ok) return setError(result.error);
    onChange(result.application);
  }

  async function withdraw() {
    setBusy(true);
    const ok = await withdrawMyApplication(jobId).catch(() => false);
    setBusy(false);
    if (!ok) return setError(t.withdrawFailed);
    onChange(null);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-foreground/40 md:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-card bg-surface p-4 shadow-pop md:rounded-card md:p-5"
      >
        <h2 id={titleId} className="text-subtitle font-semibold">
          {mine ? t.titleMine : t.titleNew}
        </h2>
        <p className="mt-1 text-body text-muted">{jobTitle}</p>

        {mine ? (
          <div className="mt-3 space-y-3">
            <p role="status" className="rounded-control bg-brand-soft px-3 py-2 text-body text-brand">
              {mine.status}
            </p>
            {mine.note && (
              <p className="text-body">
                {t.note("")}
                <span lang={contentLang(mine.note)}>{mine.note}</span>
              </p>
            )}
            <p className="text-meta text-muted">{t.progressWhere}</p>
            {error && (
              <p role="alert" className="text-body text-danger">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button ref={first} type="button" onClick={onClose} className={buttonClass("primary")}>
                {t.ok}
              </button>
              <button type="button" onClick={withdraw} className={buttonClass("link")} {...busyProps(busy)}>
                {t.withdraw}
              </button>
            </div>
          </div>
        ) : (
          <form
            className="mt-3 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <section aria-label={t.shown} className="rounded-control bg-background p-3">
              <p className="text-meta text-muted">{t.shownHint}</p>
              {page ? (
                <>
                  <p className="mt-1 font-medium">
                    {page.name}
                    {page.headline && <span className="font-normal text-muted"> · {page.headline}</span>}
                  </p>
                  <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-meta">
                    {facts.map((f) => (
                      <div key={f.label} className="contents">
                        <dt className="text-muted">{f.label}</dt>
                        <dd>{f.value}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              ) : (
                <p className="mt-1 text-body text-warn">{t.noName}</p>
              )}
              <Link href="/profile" className="mt-1 inline-flex min-h-11 items-center text-meta text-brand underline">
                {t.editProfile}
              </Link>
            </section>
            <div>
              <label htmlFor={`${titleId}-note`} className="text-body font-medium">
                {t.noteLabel}
              </label>
              <textarea
                ref={first}
                id={`${titleId}-note`}
                value={note}
                maxLength={NOTE_MAX}
                rows={3}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t.notePlaceholder}
                className={`mt-1 ${inputClass({ multiline: true })}`}
              />
              <p className="text-right text-meta text-muted">
                {[...note].length} / {NOTE_MAX}
              </p>
            </div>
            <p className="text-meta text-muted">{t.privacy}</p>
            {error && (
              <p role="alert" className="text-body text-danger">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={!page} className={buttonClass("primary")} {...busyProps(busy)}>
                {busy ? t.submitting : t.submit}
              </button>
              <button type="button" onClick={onClose} className={buttonClass("link")}>
                {t.cancel}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/**
 * 申请 on a job row (#84): opens the job with the form (signed out: sign-in first). 已申请 once applied. Not shown in
 * the employer identity. Sits above the row's stretched title link, like 收藏. From 768 px only: on a phone the row
 * would need another line (three whole rows must fit on a 375 × 812 screen, A21), and tapping the row opens the job,
 * whose bar at the bottom has 申请.
 */
export function ApplyRowButton({ jobId, title }: { jobId: string; title: string }) {
  const hydrated = useHydrated();
  const session = useSession();
  const applied = useAppliedJobIds();
  const router = useRouter();
  const t = useMessages(seekerJobsMessages).apply;
  if (hydrated && session?.activeRole === "employer") return null;
  if (session && applied?.has(jobId))
    return (
      <span className="relative z-10 inline-flex min-h-8 items-center px-1.5 text-meta text-brand">{t.applied}</span>
    );
  return (
    <button
      type="button"
      disabled={!hydrated}
      aria-label={t.label(title)}
      onClick={() => router.push(session ? `/jobs/${jobId}?${APPLY_PARAM}=1` : applyAfterSignInHref(jobId))}
      className="relative z-10 hidden min-h-8 items-center gap-1 rounded-control px-1.5 text-meta text-muted after:absolute after:inset-x-0 after:-inset-y-1.5 hover:text-brand disabled:opacity-60 md:inline-flex"
    >
      <Send aria-hidden="true" className="size-4" />
      {t.apply}
    </button>
  );
}
