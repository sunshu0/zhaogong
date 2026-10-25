"use client";
import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import type { Employer } from "@/lib/types";
import { lookupBusiness, requestVerification, type MyVerification } from "@/app/[lang]/employer/actions";
import type { MyTeam } from "@/app/[lang]/employer/team-actions";
import type { RegisterEntry } from "@/components/employer/business-register";
import { EmployerGate, type EmployerIdentity } from "@/components/employer/EmployerGate";
import { useEmployerProfile, useMyTeam, useMyVerification } from "@/components/employer/use-employer";
import { useFocusOnChange } from "@/components/employer/use-focus-on-change";
import { canApplyFor, kindLabels, rejectReasons, type VerifyKind } from "@/components/employer/verification";
import { VerificationBadge } from "@/components/seeker/VerificationBadge";
import { Button, buttonClass } from "@/components/ui/Button";
import { busyProps } from "@/components/ui/busy";
import { Radio } from "@/components/ui/Checkbox";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { inputClass } from "@/components/ui/input-class";
import { LoadFailed } from "@/components/ui/LoadFailed";
import { employerCommonMessages } from "@/i18n/messages/employer-common";
import { uiMessages } from "@/i18n/messages/ui";
import { BACK_LINK, noticeClass } from "@/components/employer/app-style";
import { useLang, useMessages } from "@/i18n/client";
import { contentLang, type Lang } from "@/i18n/lang";
import { formatDate } from "@/i18n/format";
import { employerVerifyMessages } from "@/i18n/messages/employer-verify";

/** When an application was sent: 10月18日 15:05 / 18 Oct, 3:05 pm, always New Zealand time. */
/** When the request was sent: the Chinese as before (09:05), English without the leading zero (9:05 am). */
const whenOptions = (lang: Lang): Intl.DateTimeFormatOptions => ({
  month: "numeric",
  day: "numeric",
  hour: lang === "en" ? "numeric" : "2-digit",
  minute: "2-digit",
});

// #257: the shared text box, 16px so phones do not zoom in.
const INPUT = inputClass();

/**
 * 企业验证 (#78): find the company in the business register, say who is applying and give the company's phone, then
 * a moderator checks it by hand. The badge changes only once they approve.
 */
export function VerifyBusiness() {
  return <EmployerGate next="/employer/verify">{(me) => <Verify me={me} />}</EmployerGate>;
}

function Verify({ me }: { me: EmployerIdentity }) {
  const lang = useLang();
  const words = useMessages(employerVerifyMessages);
  const names = useMessages(employerCommonMessages).load;
  const t = words.verify;
  const kindLabel = kindLabels(lang);
  const { profile, reload: reloadProfile } = useEmployerProfile(me.email);
  const { request, failed: requestFailed, reload } = useMyVerification(me.email);
  const { team, failed: teamFailed, reload: reloadTeam } = useMyTeam(me.email);
  // Only an admin of the team applies (#87); the server refuses anyone else too.
  const isMember = team?.me.role === "member";
  const employer: Pick<Employer, "name" | "verification" | "businessNumber" | "bannedAt"> = profile ?? {
    name: me.employerName,
    verification: "unverified",
  };
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const messageRef = useFocusOnChange<HTMLParagraphElement>(message);
  const kinds = (Object.keys(kindLabel) as VerifyKind[]).filter((kind) => canApplyFor(employer.verification, kind));
  const admins = adminNames(team).join(t.adminsJoiner);
  const canApply = request !== undefined && request?.status !== "pending" && kinds.length > 0 && !employer.bannedAt;

  const submitted = (result: { ok: true; request: MyVerification } | { ok: false; error_zh: string }) => {
    setMessage(result.ok ? { ok: true, text: t.submitted } : { ok: false, text: result.error_zh });
    if (result.ok) {
      reload();
      reloadProfile();
    }
  };

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-title font-semibold">{t.heading}</h1>
        <p className="flex flex-wrap items-center gap-2 text-body">
          {/* The business's name is its own words, so it leads the line in its own lang. */}
          <span>
            <span lang={contentLang(employer.name)}>{employer.name}</span>
            {t.nowIs}
          </span>{" "}
          <VerificationBadge verification={employer.verification} lang={lang} />
          {employer.businessNumber && <span className="text-muted">{t.nzbn(employer.businessNumber)}</span>}
        </p>
      </header>

      {message && (
        <p ref={messageRef} tabIndex={-1} role="status" className={noticeClass(message.ok)}>
          {message.text}
        </p>
      )}

      {/* #246: with no answer about the application or the team, the form cannot be shown either. */}
      {requestFailed || teamFailed ? (
        <LoadFailed
          what={names.verification}
          onRetry={() => {
            if (requestFailed) reload();
            if (teamFailed) reloadTeam();
          }}
        />
      ) : request === undefined ? (
        <SkeletonCard />
      ) : (
        request && <LatestRequest request={request} />
      )}

      {employer.bannedAt && <p className="text-body text-danger">{t.banned}</p>}
      {request !== undefined && kinds.length === 0 && (
        <p className="text-body text-muted">{t.nothingLeft(kindLabel.accredited_employer)}</p>
      )}

      <BadgeMeaning />

      {canApply && isMember && (
        <p className="rounded-card bg-surface p-4 text-body ring-1 ring-border">
          {t.adminOnlyBefore}
          {/* The admins' names are their own words. */}
          <span lang={contentLang(admins)}>{admins}</span>
          {t.adminOnlyAfter}
        </p>
      )}

      {canApply && team && !isMember && (
        <ApplyForm
          key={request?.id ?? "first"}
          kinds={kinds}
          again={request?.status === "rejected" ? request : undefined}
          onDone={submitted}
        />
      )}

      <p className="text-meta text-muted">
        <Link href="/employer/jobs" className={BACK_LINK}>
          {t.backToJobs}
        </Link>
      </p>
    </div>
  );
}

/** Where the latest application stands: waiting, approved, or rejected with the moderator's reason. */
function LatestRequest({ request }: { request: MyVerification }) {
  const lang = useLang();
  const words = useMessages(employerVerifyMessages);
  const t = words.request;
  if (request.status === "withdrawn") return null;
  const tone =
    request.status === "pending" ? "bg-warn-soft" : request.status === "approved" ? "bg-ok-soft" : "bg-danger-soft";
  return (
    <section aria-label={t.sectionLabel} className={`space-y-2 rounded-card p-4 text-body ${tone}`}>
      <h2 className="font-semibold">
        {request.status === "pending"
          ? t.pendingTitle
          : request.status === "approved"
            ? t.approvedTitle(kindLabels(lang)[request.kind])
            : t.rejectedTitle}
      </h2>
      {request.status === "pending" && <p>{t.pendingNote}</p>}
      {request.status === "rejected" && request.rejectReason && (
        // The note is the moderator's own words, so it carries its own lang.
        <p className="text-danger">
          {rejectReasons(lang)[request.rejectReason]}
          {t.rejectionJoiner}
          <span lang={contentLang(request.rejectNote)}>{request.rejectNote ?? ""}</span>
        </p>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-meta">
        <dt className="text-muted">{t.appliedFor}</dt>
        <dd>{kindLabels(lang)[request.kind]}</dd>
        <dt className="text-muted">{t.business}</dt>
        <dd>
          <span lang="en">{request.legalName}</span> · {words.verify.nzbn(request.nzbn)}
        </dd>
        <dt className="text-muted">{t.contact}</dt>
        <dd>
          <span lang={contentLang(request.contactName)}>{request.contactName}</span>
          {t.contactRoleOpen}
          <span lang={contentLang(request.contactRole)}>{request.contactRole}</span>
          {t.contactRoleClose}
          {request.companyPhone}
        </dd>
        <dt className="text-muted">{t.sentAt}</dt>
        <dd>
          <time dateTime={request.submittedAt}>{formatDate(request.submittedAt, lang, whenOptions(lang))}</time>
        </dd>
      </dl>
    </section>
  );
}

/** Find the company, then who applies and the company's phone. A rejected application's details are filled in. */
function ApplyForm({
  kinds,
  again,
  onDone,
}: {
  kinds: VerifyKind[];
  again?: MyVerification;
  onDone: (result: Awaited<ReturnType<typeof requestVerification>>) => void;
}) {
  const words = useMessages(employerVerifyMessages);
  const t = words.form;
  const [query, setQuery] = useState(again?.nzbn ?? "");
  const [found, setFound] = useState<{ results: RegisterEntry[]; error_zh?: string }>();
  const [chosen, setChosen] = useState<RegisterEntry>();
  // #262: how many answers 查询 has had; the reason line is drawn afresh for each, so the same reason is said again.
  const [answers, setAnswers] = useState(0);
  const [kind, setKind] = useState<VerifyKind>(again && kinds.includes(again.kind) ? again.kind : kinds[0]);
  const [contactName, setContactName] = useState(again?.contactName ?? "");
  const [contactRole, setContactRole] = useState(again?.contactRole ?? "");
  const [companyPhone, setCompanyPhone] = useState(again?.companyPhone ?? "");
  const [website, setWebsite] = useState(again?.website ?? "");
  const [pending, startTransition] = useTransition();
  const detailsHeading = useFocusOnChange<HTMLHeadingElement>(chosen?.nzbn);
  const noAnswer = useMessages(uiMessages).load.noAnswer;
  const listed = !!found && found.results.length > 0 && !chosen;

  function search(e: FormEvent) {
    e.preventDefault();
    setChosen(undefined);
    // #247: with no answer the form says so where results would be, and keeps the search.
    startTransition(async () => {
      const answer = await lookupBusiness(query).catch(() => ({ results: [], error_zh: noAnswer }));
      setAnswers((n) => n + 1);
      setFound(answer);
    });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!chosen) return;
    // #247: with no answer the page says so and the form stays as filled in.
    startTransition(async () =>
      onDone(
        await requestVerification({ nzbn: chosen.nzbn, kind, contactName, contactRole, companyPhone, website }).catch(
          () => ({ ok: false as const, error_zh: noAnswer }),
        ),
      ),
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={search} className="space-y-2">
        <h2 className="text-subtitle font-semibold">{again ? t.againTitle : t.findTitle}</h2>
        <label htmlFor="verify-query" className="block text-body font-medium">
          {t.queryLabel}
        </label>
        <div className="flex gap-2">
          <input
            id="verify-query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.queryPlaceholder}
            className={`${inputClass()} min-w-0 flex-1`}
          />
          {/* #202: disabled only while there is nothing to search for; a search on its way keeps the focus. */}
          {/* ADR 0036: one main button a screen — the details form's 提交 once a business is chosen. */}
          <Button
            type="submit"
            variant={chosen ? "secondary" : "primary"}
            loading={pending && !chosen}
            disabled={!query.trim()}
            {...busyProps(pending)}
          >
            {t.search}
          </Button>
        </div>
        <p className="text-meta text-muted">{t.demoRegisterNote}</p>
      </form>

      {/* #248: why 查询 found nothing (or got no answer) is said; the focus stays on the search. */}
      {found?.error_zh && (
        <p key={answers} role="alert" className="text-body text-warn">
          {found.error_zh}
        </p>
      )}
      {/* #262: how many it found, in a status there all through the search step (empty and out of the flow until
          then); gone once a company is chosen, where the submit's own status takes over. */}
      {!chosen && (
        <p role="status" className={listed ? "text-body" : "sr-only"}>
          {listed ? t.foundCount(found?.results.length ?? 0) : ""}
        </p>
      )}
      {listed && found && (
        <ul className="space-y-2">
          {found.results.map((entry) => (
            <li key={entry.nzbn} className="rounded-card bg-surface p-4 ring-1 ring-border">
              <p className="font-medium" lang="en">
                {entry.legalName}
              </p>
              <p className="text-body text-muted">
                {t.resultLine(entry.nzbn)}
                <span lang={contentLang(entry.tradingNames.join(t.namesJoiner))}>
                  {entry.tradingNames.join(t.namesJoiner)}
                </span>
              </p>
              <p className={`mt-1 text-body ${entry.status === "registered" ? "text-ok" : "text-danger"}`}>
                {entry.status === "registered" ? t.statusRegistered : t.statusRemoved}
              </p>
              {/* #202: a business that was removed from the register can never be chosen; pending only holds. */}
              <button
                type="button"
                disabled={entry.status !== "registered"}
                onClick={() => setChosen(entry)}
                className={`${buttonClass("secondary", { block: true })} mt-3`}
                {...busyProps(pending)}
              >
                {t.choose}
              </button>
            </li>
          ))}
        </ul>
      )}

      {chosen && (
        <form onSubmit={submit} className="space-y-3 rounded-card bg-surface p-4 ring-1 ring-border">
          <h2 ref={detailsHeading} tabIndex={-1} className="text-subtitle font-semibold outline-none">
            {t.whoTitle}
          </h2>
          <p className="text-body">
            <span lang="en">{chosen.legalName}</span> · {words.verify.nzbn(chosen.nzbn)}
            <button
              type="button"
              onClick={() => setChosen(undefined)}
              className="pressable ml-2 min-h-11 text-meta text-brand underline"
            >
              {t.changeBusiness}
            </button>
          </p>
          {kinds.length > 1 && (
            <fieldset className="space-y-1 px-2">
              <legend className="-ml-2 text-body font-medium">{t.kindLegend}</legend>
              {kinds.map((k) => (
                <Radio key={k} name="verify-kind" checked={kind === k} onChange={() => setKind(k)}>
                  {k === "business_verified" ? t.kindBusinessVerified : t.kindAccredited}
                </Radio>
              ))}
            </fieldset>
          )}
          <Field id="verify-name" label={t.contactNameLabel} value={contactName} onChange={setContactName} />
          <Field
            id="verify-role"
            label={t.contactRoleLabel}
            value={contactRole}
            onChange={setContactRole}
            placeholder={t.contactRolePlaceholder}
          />
          <Field
            id="verify-phone"
            label={t.companyPhoneLabel}
            value={companyPhone}
            onChange={setCompanyPhone}
            type="tel"
            hint={t.companyPhoneHint}
          />
          <Field
            id="verify-website"
            label={t.websiteLabel}
            value={website}
            onChange={setWebsite}
            type="url"
            required={false}
            placeholder={t.websitePlaceholder}
          />
          <Button type="submit" size="lg" block loading={pending}>
            {pending ? t.submitting : t.submit}
          </Button>
        </form>
      )}
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  required = true,
  placeholder,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-body font-medium">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-meta text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

function BadgeMeaning() {
  const t = useMessages(employerVerifyMessages).meaning;
  return (
    <section className="space-y-3 rounded-card bg-surface p-4 ring-1 ring-border text-body leading-relaxed">
      <div>
        <h2 className="font-medium text-ok">{t.isTitle}</h2>
        <p className="mt-1">{t.isBody}</p>
      </div>
      <div>
        <h2 className="font-medium text-warn">{t.isNotTitle}</h2>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          {t.isNotPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function adminNames(team: MyTeam | null | undefined): string[] {
  return (team?.members ?? []).filter((m) => m.role === "admin").map((m) => m.name ?? m.email);
}
