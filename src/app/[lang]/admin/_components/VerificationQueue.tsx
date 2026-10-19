"use client";
import { useId, useState, useTransition, type RefObject } from "react";
import type { AdminResult } from "@/app/[lang]/admin/actions";
import type { Refused } from "@/app/[lang]/admin/actions";
import { isFailed, settle, type Failed } from "@/app/[lang]/admin/load-state";
import {
  approveVerification,
  getVerificationQueue,
  rejectVerification,
  type VerificationItem,
} from "@/app/[lang]/admin/verification-actions";
import { Cancel } from "@/app/[lang]/admin/_components/Cancel";
import { Empty, Loading } from "@/app/[lang]/admin/_components/Empty";
import { LoadFailed, TryAgain } from "@/app/[lang]/admin/_components/Failed";
import { useAdminLoad } from "@/app/[lang]/admin/_components/use-admin-load";
import { useSwapFocus } from "@/components/ui/use-swap-focus";
import {
  kindLabels,
  missingChecks,
  rejectReasons,
  type Checklist,
  type RejectReason,
} from "@/components/employer/verification";
import { useLang, useMessages } from "@/i18n/client";
import { contentLang } from "@/i18n/lang";
import { formatDate } from "@/i18n/format";
import { adminVerificationMessages } from "@/i18n/messages/admin-verification";
import { Button } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { Checkbox, Radio } from "@/components/ui/Checkbox";
import { inputClass } from "@/components/ui/input-class";
import { Tag } from "@/components/ui/Tag";
import { VerificationBadge } from "@/components/seeker/VerificationBadge";

// When an application came in: day and time, New Zealand time (format.ts).
const TIME: Intl.DateTimeFormatOptions = { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" };

/** The 企业验证 applications waiting, loaded again whenever `version` changes; the count is for the tab. */
export function useVerificationQueue(version: number) {
  return useAdminLoad<VerificationItem[] | Refused>(getVerificationQueue, version);
}

/** 企业验证 (#78): each application beside the register entry, with the checklist to work through. */
export function VerificationQueue({
  queue,
  onDone,
  onRetry,
}: {
  queue?: VerificationItem[] | Refused | Failed;
  onDone: (result: AdminResult) => void;
  onRetry: () => void;
}) {
  const t = useMessages(adminVerificationMessages);
  if (isFailed(queue)) return <LoadFailed what={t.listName} onRetry={onRetry} />;
  if (!queue) return <Loading />;
  if ("refused" in queue) return <Empty>{queue.error_zh}</Empty>;
  if (queue.length === 0) return <Empty>{t.empty}</Empty>;
  return (
    <>
      <p className="mb-3 text-meta text-muted">{t.howTo}</p>
      <ul className="space-y-3">
        {queue.map((item) => (
          <li key={item.request.id}>
            <VerificationCard item={item} onDone={onDone} />
          </li>
        ))}
      </ul>
    </>
  );
}

function VerificationCard({ item, onDone }: { item: VerificationItem; onDone: (result: AdminResult) => void }) {
  const lang = useLang();
  const t = useMessages(adminVerificationMessages);
  const { request, employer, register, checklist } = item;
  const [checks, setChecks] = useState<Checklist>({});
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState<RejectReason>();
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false); // #183: no answer came; the ticks, reason and note stay
  const missing = missingChecks(checklist, checks);
  const run = (action: () => Promise<AdminResult>) => {
    setFailed(false);
    startTransition(async () => {
      const result = await settle(action);
      if (result) onDone(result);
      else setFailed(true);
    });
  };
  const set = (id: keyof Checklist, change: Partial<{ done: boolean; note: string }>) =>
    setChecks((c) => ({ ...c, [id]: { done: false, ...c[id], ...change } }));
  const registerMatches = register?.legalName === request.legalName && register.status === "registered";
  const { opener: rejectOpenerRef, form: rejectFormRef } = useSwapFocus(rejecting);

  return (
    <article aria-label={t.cardLabel(request.tradingName)} className={`space-y-4 ${cardClass()}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 lang={contentLang(request.tradingName)} className="text-subtitle font-semibold">
          {request.tradingName}
        </h2>
        <Tag kind="neutral">{t.applyingFor(kindLabels(lang)[request.kind])}</Tag>
        {employer && <VerificationBadge verification={employer.verification} lang={lang} />}
        {employer?.bannedAt && <Tag kind="urgent">{t.banned}</Tag>}
        <span className="text-meta text-muted">{t.submitted(formatDate(request.submittedAt, lang, TIME))}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-control bg-background p-3 text-body">
          <dt className="col-span-2 text-meta font-medium text-muted">{t.register.heading}</dt>
          <dt className="text-muted">{t.register.legalName}</dt>
          <dd lang="en">{register?.legalName ?? t.register.notInRegister}</dd>
          <dt className="text-muted">NZBN</dt>
          <dd>{request.nzbn}</dd>
          <dt className="text-muted">{t.register.status}</dt>
          <dd className={register?.status === "registered" ? "text-ok" : "text-danger"}>
            {register ? (register.status === "registered" ? t.register.registered : t.register.removed) : "—"}
          </dd>
          <dt className="text-muted">{t.register.tradingNames}</dt>
          <dd lang={contentLang(register?.tradingNames.join(" "))}>
            {register ? t.register.list(register.tradingNames) : "—"}
          </dd>
        </dl>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-control bg-background p-3 text-body">
          <dt className="col-span-2 text-meta font-medium text-muted">{t.applicant.heading}</dt>
          <dt className="text-muted">{t.applicant.company}</dt>
          <dd lang="en" className={registerMatches ? "" : "text-danger"}>
            {request.legalName}
          </dd>
          <dt className="text-muted">{t.applicant.contact}</dt>
          <dd lang={contentLang(request.contactName + request.contactRole)}>
            {t.applicant.contactWithRole(request.contactName, request.contactRole)}
          </dd>
          <dt className="text-muted">{t.applicant.phone}</dt>
          <dd lang={contentLang(request.companyPhone)}>{request.companyPhone}</dd>
          <dt className="text-muted">{t.applicant.website}</dt>
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
              t.applicant.notGiven
            )}
          </dd>
        </dl>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-body font-medium">{t.checklist}</legend>
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
          formRef={rejectFormRef}
          reason={reason}
          note={note}
          pending={pending}
          onReason={setReason}
          onNote={setNote}
          onSubmit={() => run(() => rejectVerification(request.id, reason, note, checks))}
          onCancel={() => setRejecting(false)}
        />
      ) : (
        <div ref={rejectOpenerRef} className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button
            disabled={missing.length > 0}
            loading={pending}
            onClick={() => run(() => approveVerification(request.id, checks))}
          >
            {t.approve}
          </Button>
          <Button variant="danger-secondary" onClick={() => setRejecting(true)}>
            {t.reject}
          </Button>
          {missing.length > 0 && (
            <span className="text-meta text-muted">{t.unchecked(missing.map((m) => m.label))}</span>
          )}
        </div>
      )}
      {failed && <TryAgain />}
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
  const t = useMessages(adminVerificationMessages);
  return (
    <div
      className={`space-y-1.5 rounded-control border px-3 pt-1 pb-3 transition-colors duration-(--duration-press) ${done ? "border-brand/40 bg-brand-soft/40" : "border-border"}`}
    >
      <Checkbox checked={done} onChange={(e) => onDone(e.target.checked)} className="font-medium">
        {label}
        {optional && <span className="font-normal text-muted">{t.optional}</span>}
      </Checkbox>
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
        {t.noteLabel(label)}
      </label>
      <input
        id={`${id}-note`}
        value={note}
        onChange={(e) => onNote(e.target.value)}
        placeholder={t.notePlaceholder}
        className={inputClass()}
      />
    </div>
  );
}

function RejectForm({
  formRef,
  reason,
  note,
  pending,
  onReason,
  onNote,
  onSubmit,
  onCancel,
}: {
  formRef: RefObject<HTMLFieldSetElement | null>;
  reason?: RejectReason;
  note: string;
  pending: boolean;
  onReason: (reason: RejectReason) => void;
  onNote: (note: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const id = useId();
  const lang = useLang();
  const t = useMessages(adminVerificationMessages);
  const reasons = rejectReasons(lang);
  return (
    <fieldset ref={formRef} className="space-y-2 rounded-control border border-danger/40 p-3">
      <legend className="px-1 text-body font-medium">{t.rejectLegend}</legend>
      <div className="grid gap-x-4 px-2 sm:grid-cols-2">
        {(Object.keys(reasons) as RejectReason[]).map((r) => (
          <Radio key={r} name={`${id}-reason`} checked={reason === r} onChange={() => onReason(r)}>
            {reasons[r]}
          </Radio>
        ))}
      </div>
      <label htmlFor={`${id}-note`} className="block text-body">
        {t.rejectNote}
      </label>
      <textarea
        id={`${id}-note`}
        value={note}
        onChange={(e) => onNote(e.target.value)}
        rows={2}
        className={inputClass({ multiline: true })}
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="danger" disabled={!reason || !note.trim()} loading={pending} onClick={onSubmit}>
          {t.confirmReject}
        </Button>
        <Cancel onClick={onCancel} />
      </div>
    </fieldset>
  );
}
