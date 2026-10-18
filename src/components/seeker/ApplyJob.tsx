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
  const hydrated = useHydrated();
  const session = useSession();
  const router = useRouter();
  const [mine, setMine] = useState<MyApplication | null | undefined>(undefined);
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
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [seeker, jobId, router]);

  if (!hydrated || !session)
    return (
      <Link href={applyAfterSignInHref(jobId)} className={applyButton}>
        <Send aria-hidden="true" className="size-4" />
        申请
      </Link>
    );
  if (!seeker) return null;

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
        {mine ? `已申请 · ${mine.status}` : "申请"}
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
  const page = applicationProfileFrom(profile);
  const facts = page ? candidateFacts(applicantCandidate("me", page)) : [];
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
    if (!result) return setError("网络有问题，请稍后再试");
    if (!result.ok) return setError(result.error);
    onChange(result.application);
  }

  async function withdraw() {
    setBusy(true);
    const ok = await withdrawMyApplication(jobId).catch(() => false);
    setBusy(false);
    if (!ok) return setError("没能撤回，请稍后再试");
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
          {mine ? "我的申请" : "申请这个职位"}
        </h2>
        <p className="mt-1 text-body text-muted">{jobTitle}</p>

        {mine ? (
          <div className="mt-3 space-y-3">
            <p role="status" className="rounded-control bg-brand-soft px-3 py-2 text-body text-brand">
              {mine.status}
            </p>
            {mine.note && <p className="text-body">附言：{mine.note}</p>}
            <p className="text-meta text-muted">进度也在「我的 → 收藏和进度」里。</p>
            {error && (
              <p role="alert" className="text-body text-danger">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button ref={first} type="button" onClick={onClose} className={buttonClass("primary")}>
                好的
              </button>
              <button type="button" onClick={withdraw} className={buttonClass("link")} {...busyProps(busy)}>
                撤回申请
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
            <section aria-label="雇主会看到的资料" className="rounded-control bg-background p-3">
              <p className="text-meta text-muted">雇主会看到你的主页（不含联系方式）：</p>
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
                <p className="mt-1 text-body text-warn">还没有名字，雇主不知道是谁申请的。</p>
              )}
              <Link href="/profile" className="mt-1 inline-flex min-h-11 items-center text-meta text-brand underline">
                编辑我的主页
              </Link>
            </section>
            <div>
              <label htmlFor={`${titleId}-note`} className="text-body font-medium">
                附言（选填）
              </label>
              <textarea
                ref={first}
                id={`${titleId}-note`}
                value={note}
                maxLength={NOTE_MAX}
                rows={3}
                onChange={(e) => setNote(e.target.value)}
                placeholder="比如：周末都能上班，做过两年奶茶店"
                className={`mt-1 ${inputClass({ multiline: true })}`}
              />
              <p className="text-right text-meta text-muted">
                {[...note].length} / {NOTE_MAX}
              </p>
            </div>
            <p className="text-meta text-muted">申请不会把你的电话、微信或邮箱给雇主。联系方式照这个职位的方式来。</p>
            {error && (
              <p role="alert" className="text-body text-danger">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={!page} className={buttonClass("primary")} {...busyProps(busy)}>
                {busy ? "正在提交…" : "提交申请"}
              </button>
              <button type="button" onClick={onClose} className={buttonClass("link")}>
                取消
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
  if (hydrated && session?.activeRole === "employer") return null;
  if (session && applied?.has(jobId))
    return <span className="relative z-10 inline-flex min-h-8 items-center px-1.5 text-meta text-brand">已申请</span>;
  return (
    <button
      type="button"
      disabled={!hydrated}
      aria-label={`申请：${title}`}
      onClick={() => router.push(session ? `/jobs/${jobId}?${APPLY_PARAM}=1` : applyAfterSignInHref(jobId))}
      className="relative z-10 hidden min-h-8 items-center gap-1 rounded-control px-1.5 text-meta text-muted after:absolute after:inset-x-0 after:-inset-y-1.5 hover:text-brand disabled:opacity-60 md:inline-flex"
    >
      <Send aria-hidden="true" className="size-4" />
      申请
    </button>
  );
}
