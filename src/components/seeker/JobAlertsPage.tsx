"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { changeMyJobAlert, deleteMyJobAlert, myJobAlerts, type JobAlertView } from "@/app/me/alerts/actions";
import { jobsHref } from "@/components/seeker/filter-query";
import { ALERT_LIMIT, ALERT_NAME_MAX, ALERTS_PATH } from "@/components/seeker/job-alerts";
import { useHydrated, useSession } from "@/components/seeker/session-client";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Group, Section } from "@/components/ui/Section";
import { Tag } from "@/components/ui/Tag";

const SMALL =
  "inline-flex min-h-11 items-center px-1 text-body text-brand underline-offset-4 hover:underline disabled:opacity-50";

/**
 * 职位提醒 (#53): the account's saved searches. Each can be opened as a job list, renamed, paused or deleted. New
 * jobs that match a running alert show in 通知; email comes later, with an email service (#16).
 */
export function JobAlertsPage() {
  const hydrated = useHydrated();
  const session = useSession();
  const signedIn = Boolean(session);
  // undefined: loading.
  const [alerts, setAlerts] = useState<JobAlertView[] | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    let current = true;
    myJobAlerts()
      .then((list) => current && setAlerts(list))
      .catch(() => current && setError("网络有问题，提醒暂时打不开，请稍后再试。"));
    return () => {
      current = false;
    };
  }, [signedIn]);

  /** Sends a change; the server's answer is the list from then on. */
  async function run(change: () => Promise<JobAlertView[] | null>) {
    setError(null);
    try {
      const list = await change();
      if (list) setAlerts(list);
    } catch {
      setError("网络有问题，没有改成，请重试。");
    }
  }

  if (!hydrated || (signedIn && alerts === undefined && !error))
    return <div className="h-48 animate-pulse rounded-md border border-border bg-surface" aria-hidden="true" />;

  if (!session) {
    return (
      <div className="rounded-md border border-border bg-surface px-4 py-10 text-center">
        <p className="font-medium">登录后可以保存筛选条件，有新职位时提醒你</p>
        <ButtonLink href={`/login?next=${encodeURIComponent(ALERTS_PATH)}`} className="mt-4">
          登录
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="space-y-section">
      <p className="text-body text-muted">
        有新职位符合条件时，会在「通知」里告诉你，同一个职位只提醒一次。最多 {ALERT_LIMIT} 个提醒。
      </p>
      {error && (
        <p role="alert" className="text-body text-danger">
          {error}
        </p>
      )}
      {alerts && alerts.length > 0 ? (
        <Section title={`我的提醒（${alerts.length}/${ALERT_LIMIT}）`}>
          {alerts.map((alert) => (
            <AlertRow
              key={alert.id}
              alert={alert}
              onRename={(name) => run(() => changeMyJobAlert(alert.id, { name }))}
              onPause={(paused) => run(() => changeMyJobAlert(alert.id, { paused }))}
              onDelete={() => run(() => deleteMyJobAlert(alert.id))}
            />
          ))}
        </Section>
      ) : (
        alerts && (
          <div className="rounded-md border border-border bg-surface px-4 py-10 text-center">
            <p className="font-medium">还没有职位提醒</p>
            <p className="mt-1 text-body text-muted">在职位列表选好地区、行业等条件，点「保存为提醒」。</p>
            <ButtonLink href="/jobs" className="mt-4">
              去找工作
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
  onRename: (name: string) => Promise<void>;
  onPause: (paused: boolean) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const act = (work: () => Promise<void>) => async () => {
    setBusy(true);
    await work();
    setBusy(false);
  };

  return (
    <Group>
      <article aria-label={`提醒：${alert.name}`}>
        {renaming ? (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={async (event) => {
              event.preventDefault();
              const name = String(new FormData(event.currentTarget).get("name") ?? "");
              await act(() => onRename(name))();
              setRenaming(false);
            }}
          >
            <label className="sr-only" htmlFor={`alert-name-${alert.id}`}>
              提醒名称
            </label>
            <input
              id={`alert-name-${alert.id}`}
              name="name"
              defaultValue={alert.name}
              maxLength={ALERT_NAME_MAX}
              required
              autoFocus
              className="min-h-11 min-w-0 flex-1 rounded-md border border-border px-3 text-body"
            />
            <Button type="submit" disabled={busy}>
              保存
            </Button>
            <Button variant="link" onClick={() => setRenaming(false)}>
              取消
            </Button>
          </form>
        ) : (
          <h3 className="flex items-center gap-2 text-body font-medium">
            <span className="min-w-0 truncate">{alert.name}</span>
            {alert.paused && <Tag kind="neutral">已暂停</Tag>}
          </h3>
        )}
        <p className="mt-1 text-meta text-muted">
          {alert.conditions.length ? alert.conditions.join(" · ") : "不限条件：所有新职位"}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3">
          <Link href={jobsHref(alert.query)} className={SMALL}>
            看职位
          </Link>
          {!renaming && (
            <button type="button" className={SMALL} disabled={busy} onClick={() => setRenaming(true)}>
              改名
            </button>
          )}
          <button type="button" className={SMALL} disabled={busy} onClick={act(() => onPause(!alert.paused))}>
            {alert.paused ? "恢复提醒" : "暂停"}
          </button>
          {confirming ? (
            <span className="flex items-center gap-2 text-body">
              删除后不再提醒
              <button type="button" className={`${SMALL} text-danger`} disabled={busy} onClick={act(onDelete)}>
                确认删除
              </button>
              <button type="button" className={SMALL} onClick={() => setConfirming(false)}>
                取消
              </button>
            </span>
          ) : (
            <button type="button" className={`${SMALL} text-danger`} onClick={() => setConfirming(true)}>
              删除
            </button>
          )}
        </div>
      </article>
    </Group>
  );
}
