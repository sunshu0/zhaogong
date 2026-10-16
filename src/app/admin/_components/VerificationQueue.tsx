"use client";
import { useEffect, useId, useState, useTransition } from "react";
import type { AdminResult } from "@/app/admin/actions";
import type { Refused } from "@/app/admin/actions";
import {
  approveVerification,
  getVerificationQueue,
  rejectVerification,
  type VerificationItem,
} from "@/app/admin/verification-actions";
import { Empty } from "@/app/admin/_components/Empty";
import {
  KIND_LABELS,
  missingChecks,
  REJECT_REASONS,
  type Checklist,
  type RejectReason,
} from "@/components/employer/verification";
import { Section } from "@/components/ui/Section";
import { Tag } from "@/components/ui/Tag";
import { VerificationBadge } from "@/components/seeker/VerificationBadge";

const time = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Pacific/Auckland",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** The 企业验证 applications waiting, loaded again whenever `version` changes; the count is for the tab. */
export function useVerificationQueue(version: number) {
  const [queue, setQueue] = useState<VerificationItem[] | Refused>();
  useEffect(() => {
    let live = true;
    getVerificationQueue().then((q) => {
      if (live) setQueue(q);
    });
    return () => {
      live = false;
    };
  }, [version]);
  return queue;
}

/** 企业验证 (#78): each application beside the register entry, with the checklist to work through. */
export function VerificationQueue({
  queue,
  onDone,
}: {
  queue?: VerificationItem[] | Refused;
  onDone: (result: AdminResult) => void;
}) {
  if (!queue)
    return (
      <div className="-mx-4 h-40 animate-pulse border-y border-border bg-surface sm:mx-0 sm:rounded-md sm:border" />
    );
  if ("refused" in queue) return <Empty>{queue.error_zh}</Empty>;
  if (queue.length === 0) return <Empty>没有待审核的企业验证。</Empty>;
  return (
    <>
      <p className="mb-3 text-meta text-muted">
        逐项核对后打勾，必做的都打勾才能通过。电话要打公开渠道查到的公司电话，不只打申请人填的号码。核对结果和备注会存进审核记录。
      </p>
      <Section>
        <ul className="divide-y divide-border">
          {queue.map((item) => (
            <li key={item.request.id}>
              <VerificationCard item={item} onDone={onDone} />
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

function VerificationCard({ item, onDone }: { item: VerificationItem; onDone: (result: AdminResult) => void }) {
  const { request, employer, register, checklist } = item;
  const [checks, setChecks] = useState<Checklist>({});
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState<RejectReason>();
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const missing = missingChecks(checklist, checks);
  const run = (action: () => Promise<AdminResult>) => startTransition(async () => onDone(await action()));
  const button = "h-9 rounded-md border px-3 text-body disabled:opacity-40";
  const set = (id: keyof Checklist, change: Partial<{ done: boolean; note: string }>) =>
    setChecks((c) => ({ ...c, [id]: { done: false, ...c[id], ...change } }));
  const registerMatches = register?.legalName === request.legalName && register.status === "registered";

  return (
    <article aria-label={`企业验证：${request.tradingName}`} className="space-y-3 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-subtitle font-semibold">{request.tradingName}</h2>
        <Tag kind="neutral">申请{KIND_LABELS[request.kind]}</Tag>
        {employer && <VerificationBadge verification={employer.verification} />}
        {employer?.bannedAt && <Tag kind="urgent">已封禁</Tag>}
        <span className="text-meta text-muted">提交于 {time.format(new Date(request.submittedAt))}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md border border-border p-3 text-body">
          <dt className="col-span-2 text-meta font-medium text-muted">企业登记（示例登记）</dt>
          <dt className="text-muted">登记名</dt>
          <dd lang="en">{register?.legalName ?? "登记里没有这个 NZBN"}</dd>
          <dt className="text-muted">NZBN</dt>
          <dd>{request.nzbn}</dd>
          <dt className="text-muted">状态</dt>
          <dd className={register?.status === "registered" ? "text-ok" : "text-danger"}>
            {register ? (register.status === "registered" ? "已登记" : "已注销") : "—"}
          </dd>
          <dt className="text-muted">商号</dt>
          <dd>{register?.tradingNames.join("、") ?? "—"}</dd>
        </dl>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md border border-border p-3 text-body">
          <dt className="col-span-2 text-meta font-medium text-muted">雇主填的</dt>
          <dt className="text-muted">公司名</dt>
          <dd lang="en" className={registerMatches ? "" : "text-danger"}>
            {request.legalName}
          </dd>
          <dt className="text-muted">联系人</dt>
          <dd>
            {request.contactName}（{request.contactRole}）
          </dd>
          <dt className="text-muted">公司电话</dt>
          <dd>{request.companyPhone}</dd>
          <dt className="text-muted">网站</dt>
          <dd className="break-all">
            {request.website ? (
              <a
                href={request.website}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-brand underline"
              >
                {request.website}
              </a>
            ) : (
              "没有填"
            )}
          </dd>
        </dl>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-body font-medium">核对清单</legend>
        {checklist.map((check) => (
          <CheckRow
            key={check.id}
            label={check.label}
            detail={check.detail}
            optional={check.optional}
            links={check.links}
            done={!!checks[check.id]?.done}
            note={checks[check.id]?.note ?? ""}
            onDone={(done) => set(check.id, { done })}
            onNote={(text) => set(check.id, { note: text })}
          />
        ))}
      </fieldset>

      {rejecting ? (
        <RejectForm
          reason={reason}
          note={note}
          pending={pending}
          onReason={setReason}
          onNote={setNote}
          onSubmit={() => run(() => rejectVerification(request.id, reason, note, checks))}
          onCancel={() => setRejecting(false)}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pending || missing.length > 0}
            onClick={() => run(() => approveVerification(request.id, checks))}
            className={`${button} border-ok text-ok`}
          >
            通过
          </button>
          <button type="button" onClick={() => setRejecting(true)} className={`${button} border-danger text-danger`}>
            驳回
          </button>
          {missing.length > 0 && (
            <span className="text-meta text-muted">还没打勾：{missing.map((m) => m.label).join("、")}</span>
          )}
        </div>
      )}
    </article>
  );
}

function CheckRow({
  label,
  detail,
  optional,
  links,
  done,
  note,
  onDone,
  onNote,
}: {
  label: string;
  detail: string;
  optional?: boolean;
  links: { label: string; href: string }[];
  done: boolean;
  note: string;
  onDone: (done: boolean) => void;
  onNote: (note: string) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5 rounded-md border border-border p-3">
      <label className="flex items-start gap-2 text-body font-medium">
        <input
          type="checkbox"
          checked={done}
          onChange={(e) => onDone(e.target.checked)}
          className="mt-1 accent-brand"
        />
        <span>
          {label}
          {optional && <span className="font-normal text-muted">（选填）</span>}
        </span>
      </label>
      <p className="text-meta text-muted">{detail}</p>
      {links.length > 0 && (
        <p className="flex flex-wrap gap-x-3 text-meta">
          {links.map((link) => (
            <a
              key={link.href + link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand underline"
            >
              {link.label}
            </a>
          ))}
        </p>
      )}
      <label htmlFor={`${id}-note`} className="sr-only">
        {label}的备注
      </label>
      <input
        id={`${id}-note`}
        value={note}
        onChange={(e) => onNote(e.target.value)}
        placeholder="备注（选填）"
        className="h-9 w-full rounded-md border border-border bg-surface px-2 text-body"
      />
    </div>
  );
}

function RejectForm({
  reason,
  note,
  pending,
  onReason,
  onNote,
  onSubmit,
  onCancel,
}: {
  reason?: RejectReason;
  note: string;
  pending: boolean;
  onReason: (reason: RejectReason) => void;
  onNote: (note: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const id = useId();
  return (
    <fieldset className="space-y-2 rounded-md border border-danger/40 p-3">
      <legend className="px-1 text-body font-medium">驳回理由（雇主会看到）</legend>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(REJECT_REASONS) as RejectReason[]).map((r) => (
          <label key={r} className="inline-flex items-center gap-1.5 text-body">
            <input
              type="radio"
              name={`${id}-reason`}
              checked={reason === r}
              onChange={() => onReason(r)}
              className="accent-brand"
            />
            {REJECT_REASONS[r]}
          </label>
        ))}
      </div>
      <label htmlFor={`${id}-note`} className="block text-body">
        说明
      </label>
      <textarea
        id={`${id}-note`}
        value={note}
        onChange={(e) => onNote(e.target.value)}
        rows={2}
        className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-body"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || !reason || !note.trim()}
          onClick={onSubmit}
          className="h-9 rounded-md border border-danger bg-danger px-3 text-body text-white disabled:opacity-40"
        >
          确定驳回
        </button>
        <button type="button" onClick={onCancel} className="h-9 px-2 text-body text-muted underline">
          取消
        </button>
      </div>
    </fieldset>
  );
}
