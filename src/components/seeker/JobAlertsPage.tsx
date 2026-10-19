"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { changeMyJobAlert, deleteMyJobAlert, myJobAlerts, type JobAlertView } from "@/app/[lang]/me/alerts/actions";
import { identityScope } from "@/components/seeker/identity-scope";
import { ALERT_LIMIT, ALERT_NAME_MAX, ALERTS_PATH } from "@/components/seeker/job-alerts";
import { useHydrated, useSession } from "@/components/seeker/session-client";
import { RetryLine } from "@/components/seeker/RetryLine";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Group, Section } from "@/components/ui/Section";
import { Tag } from "@/components/ui/Tag";
import { cardClass } from "@/components/ui/Card";
import { inputClass } from "@/components/ui/input-class";
import { busyProps } from "@/components/ui/busy";
import { SkeletonList } from "@/components/ui/Skeleton";
import { externalWords } from "@/lib/external-jobs/labels";
import { useLang, useMessages } from "@/i18n/client";
import { seekerMeMessages } from "@/i18n/messages/seeker-me";
import { contentLang } from "@/i18n/lang";

const SMALL =
  "inline-flex min-h-11 items-center px-1 text-body text-brand underline-offset-4 hover:underline disabled:opacity-50 aria-disabled:opacity-50";

/**
 * 职位提醒 (#53): the account's saved searches, of the job list or of 实习 and 专业职位 (#131). Each can be opened as
 * its list, renamed, paused or deleted. New jobs that match a running alert show in 通知; email comes later, with an
 * email service (#16).
 */
export function JobAlertsPage() {
  const t = useMessages(seekerMeMessages);
  const a = t.alerts;
  const hydrated = useHydrated();
  const session = useSession();
  const signedIn = Boolean(session);
  const scope = identityScope(session);
  // undefined: loading.
  const [alerts, setAlerts] = useState<JobAlertView[] | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  // The list got no answer (#254): said with 重试, which asks again; kept per identity, so another identity's list
  // is not hidden behind it.
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const [asked, setAsked] = useState(0);
  const loadFailed = failedFor === scope;
  const top = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!signedIn) return;
    let current = true;
    myJobAlerts()
      .then((list) => current && setAlerts(list))
      .catch(() => current && setFailedFor(scope));
    return () => {
      current = false;
    };
  }, [signedIn, scope, asked]);

  /** Sends a change; the server's answer is the list from then on. True when the server took it. */
  async function run(change: () => Promise<JobAlertView[] | null>): Promise<boolean> {
    setError(null);
    try {
      const list = await change();
      if (list) setAlerts(list);
      return Boolean(list);
    } catch {
      setError(a.changeFailed);
      return false;
    }
  }

  if (!hydrated || (signedIn && alerts === undefined && !error && !loadFailed))
    return <SkeletonList count={2} label={t.pages.loadingAlerts} />;

  if (!session) {
    return (
      <div className={`py-10 text-center ${cardClass()}`}>
        <p className="text-body font-medium">{a.signInFor}</p>
        <ButtonLink href={`/login?next=${encodeURIComponent(ALERTS_PATH)}`} className="mt-4">
          {t.pages.signIn}
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="space-y-section">
      <p ref={top} tabIndex={-1} className="text-body text-muted outline-none">
        {a.howItWorks(ALERT_LIMIT)}
      </p>
      {loadFailed && (
        <RetryLine
          text={a.loadFailed}
          onRetry={() => {
            setFailedFor(null);
            setAsked((n) => n + 1);
          }}
        />
      )}
      {error && (
        <p role="alert" className="text-body text-danger">
          {error}
        </p>
      )}
      {alerts && alerts.length > 0 ? (
        <Section look="app" title={a.mine(alerts.length, ALERT_LIMIT)}>
          {alerts.map((alert) => (
            <AlertRow
              key={alert.id}
              alert={alert}
              onRename={(name) => run(() => changeMyJobAlert(alert.id, { name }))}
              onPause={async (paused) => void (await run(() => changeMyJobAlert(alert.id, { paused })))}
              onDelete={async () => {
                // The row and its buttons go away: the focus goes to the line above the list (#202).
                if (await run(() => deleteMyJobAlert(alert.id))) top.current?.focus();
              }}
            />
          ))}
        </Section>
      ) : (
        alerts && (
          <div className={`py-10 text-center ${cardClass()}`}>
            <p className="text-body font-medium">{a.emptyTitle}</p>
            <p className="mt-1 text-body text-muted">{a.emptyHint}</p>
            <ButtonLink href="/jobs" className="mt-4">
              {a.findJobs}
            </ButtonLink>
          </div>
        )
      )}
    </div>
  );
}

function AlertRow({
  alert,
  onRename,
  onPause,
  onDelete,
}: {
  alert: JobAlertView;
  /** True when the server took the new name. */
  onRename: (name: string) => Promise<boolean>;
  onPause: (paused: boolean) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const a = useMessages(seekerMeMessages).alerts;
  const sections = externalWords(useLang()).sections;
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const renameButton = useRef<HTMLButtonElement>(null);
  const backToRename = useRef(false);
  const act = (work: () => Promise<void>) => async () => {
    setBusy(true);
    await work();
    setBusy(false);
  };
  // The name form goes away (saved or cancelled): the focus goes back to 改名 (#202).
  const closeRename = () => {
    backToRename.current = true;
    setRenaming(false);
  };
  useEffect(() => {
    if (renaming || !backToRename.current) return;
    backToRename.current = false;
    renameButton.current?.focus();
  }, [renaming]);

  return (
    <Group>
      <article aria-label={a.label(alert.name)}>
        {renaming ? (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={async (event) => {
              event.preventDefault();
              const name = String(new FormData(event.currentTarget).get("name") ?? "");
              setBusy(true);
              const saved = await onRename(name);
              setBusy(false);
              // Not taken (offline, #251): the form stays with what was typed, the reason is above the list.
              if (saved) closeRename();
            }}
          >
            <label className="sr-only" htmlFor={`alert-name-${alert.id}`}>
              {a.name}
            </label>
            <input
              id={`alert-name-${alert.id}`}
              name="name"
              defaultValue={alert.name}
              maxLength={ALERT_NAME_MAX}
              required
              autoFocus
              className={`${inputClass()} min-w-0 flex-1`}
            />
            <Button type="submit" loading={busy}>
              {a.save}
            </Button>
            <Button variant="link" onClick={closeRename}>
              {a.cancel}
            </Button>
          </form>
        ) : (
          <h3 className="flex items-center gap-2 text-body font-medium">
            <span lang={contentLang(alert.name)} className="min-w-0 truncate">
              {alert.name}
            </span>
            {alert.section && <Tag kind="neutral">{a.external(sections[alert.section])}</Tag>}
            {alert.paused && <Tag kind="neutral">{a.paused}</Tag>}
          </h3>
        )}
        <p className="mt-1 text-meta text-muted">
          {alert.conditions.length
            ? alert.conditions.join(" · ")
            : alert.section
              ? a.anyInSection(sections[alert.section])
              : a.anyJobs}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3">
          <Link href={alert.href} className={SMALL}>
            {a.view}
          </Link>
          {!renaming && (
            <button
              ref={renameButton}
              type="button"
              className={SMALL}
              onClick={() => setRenaming(true)}
              {...busyProps(busy)}
            >
              {a.rename}
            </button>
          )}
          <button type="button" className={SMALL} onClick={act(() => onPause(!alert.paused))} {...busyProps(busy)}>
            {alert.paused ? a.resume : a.pause}
          </button>
          {confirming ? (
            <span className="flex items-center gap-2 text-body">
              {a.deleteWarning}
              <button type="button" className={`${SMALL} text-danger`} onClick={act(onDelete)} {...busyProps(busy)}>
                {a.confirmDelete}
              </button>
              <button type="button" className={SMALL} onClick={() => setConfirming(false)}>
                {a.cancel}
              </button>
            </span>
          ) : (
            <button type="button" className={`${SMALL} text-danger`} onClick={() => setConfirming(true)}>
              {a.delete}
            </button>
          )}
        </div>
      </article>
    </Group>
  );
}
