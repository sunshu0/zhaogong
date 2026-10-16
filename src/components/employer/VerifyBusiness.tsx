"use client";
import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import type { Employer } from "@/lib/types";
import { lookupBusiness, requestVerification, type MyVerification } from "@/app/employer/actions";
import type { RegisterEntry } from "@/components/employer/business-register";
import { EmployerGate, type EmployerIdentity } from "@/components/employer/EmployerGate";
import { useEmployerProfile, useMyVerification } from "@/components/employer/use-employer";
import { useFocusOnChange } from "@/components/employer/use-focus-on-change";
import { canApplyFor, KIND_LABELS, REJECT_REASONS, type VerifyKind } from "@/components/employer/verification";
import { VerificationBadge } from "@/components/seeker/VerificationBadge";

const when = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Pacific/Auckland",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const INPUT = "h-11 w-full rounded-md border border-border bg-surface px-3";

/**
 * 企业验证 (#78): find the company in the business register, say who is applying and give the company's phone, then
 * a moderator checks it by hand. The badge changes only once they approve.
 */
export function VerifyBusiness() {
  return <EmployerGate next="/employer/verify">{(me) => <Verify me={me} />}</EmployerGate>;
}

function Verify({ me }: { me: EmployerIdentity }) {
  const { profile, reload: reloadProfile } = useEmployerProfile(me.email);
  const { request, reload } = useMyVerification(me.email);
  const employer: Pick<Employer, "name" | "verification" | "businessNumber" | "bannedAt"> = profile ?? {
    name: me.employerName,
    verification: "unverified",
  };
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const messageRef = useFocusOnChange<HTMLParagraphElement>(message);
  const kinds = (Object.keys(KIND_LABELS) as VerifyKind[]).filter((kind) => canApplyFor(employer.verification, kind));
  const canApply = request !== undefined && request?.status !== "pending" && kinds.length > 0 && !employer.bannedAt;

  const submitted = (result: { ok: true; request: MyVerification } | { ok: false; error_zh: string }) => {
    setMessage(
      result.ok
        ? { ok: true, text: "已提交，审核员核对后会在通知里告诉你结果。" }
        : { ok: false, text: result.error_zh },
    );
    if (result.ok) {
      reload();
      reloadProfile();
    }
  };

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-title font-semibold">企业验证</h1>
        <p className="flex flex-wrap items-center gap-2 text-body">
          {employer.name} 现在是 <VerificationBadge verification={employer.verification} />
          {employer.businessNumber && <span className="text-muted">NZBN {employer.businessNumber}</span>}
        </p>
      </header>

      {message && (
        <p
          ref={messageRef}
          tabIndex={-1}
          role="status"
          className={`rounded-md px-3 py-2 text-body outline-none ${message.ok ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger"}`}
        >
          {message.text}
        </p>
      )}

      {request === undefined ? (
        <div className="h-24 animate-pulse rounded-md border border-border bg-surface" />
      ) : (
        request && <LatestRequest request={request} />
      )}

      {employer.bannedAt && <p className="text-body text-danger">账号已被停用，不能申请验证。</p>}
      {request !== undefined && kinds.length === 0 && (
        <p className="text-body text-muted">你的店铺已经是「{KIND_LABELS.accredited_employer}」，不需要再申请。</p>
      )}

      <BadgeMeaning />

      {canApply && (
        <ApplyForm
          key={request?.id ?? "first"}
          kinds={kinds}
          again={request?.status === "rejected" ? request : undefined}
          onDone={submitted}
        />
      )}

      <p className="text-meta text-muted">
        <Link href="/employer/jobs" className="text-brand underline">
          回到职位管理
        </Link>
      </p>
    </div>
  );
}

/** Where the latest application stands: waiting, approved, or rejected with the moderator's reason. */
function LatestRequest({ request }: { request: MyVerification }) {
  if (request.status === "withdrawn") return null;
  const tone =
    request.status === "pending"
      ? "border-warn/40 bg-warn-soft"
      : request.status === "approved"
        ? "border-ok/40 bg-ok-soft"
        : "border-danger/40 bg-danger-soft";
  return (
    <section aria-label="验证申请" className={`space-y-2 rounded-md border p-4 text-body ${tone}`}>
      <h2 className="font-semibold">
        {request.status === "pending"
          ? "验证审核中"
          : request.status === "approved"
            ? `已通过：${KIND_LABELS[request.kind]}`
            : "上次申请没有通过"}
      </h2>
      {request.status === "pending" && (
        <p>
          审核员会核对企业登记，并打公开渠道查到的公司电话确认你在这家公司。审核期间照样可以发职位，标识显示「未验证」。结果会在通知里告诉你。
        </p>
      )}
      {request.status === "rejected" && request.rejectReason && (
        <p className="text-danger">
          {REJECT_REASONS[request.rejectReason]}：{request.rejectNote}
        </p>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-meta">
        <dt className="text-muted">申请</dt>
        <dd>{KIND_LABELS[request.kind]}</dd>
        <dt className="text-muted">公司</dt>
        <dd>
          <span lang="en">{request.legalName}</span> · NZBN {request.nzbn}
        </dd>
        <dt className="text-muted">联系人</dt>
        <dd>
          {request.contactName}（{request.contactRole}）· {request.companyPhone}
        </dd>
        <dt className="text-muted">提交</dt>
        <dd>
          <time dateTime={request.submittedAt}>{when.format(new Date(request.submittedAt))}</time>
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
  const [query, setQuery] = useState(again?.nzbn ?? "");
  const [found, setFound] = useState<{ results: RegisterEntry[]; error_zh?: string }>();
  const [chosen, setChosen] = useState<RegisterEntry>();
  const [kind, setKind] = useState<VerifyKind>(again && kinds.includes(again.kind) ? again.kind : kinds[0]);
  const [contactName, setContactName] = useState(again?.contactName ?? "");
  const [contactRole, setContactRole] = useState(again?.contactRole ?? "");
  const [companyPhone, setCompanyPhone] = useState(again?.companyPhone ?? "");
  const [website, setWebsite] = useState(again?.website ?? "");
  const [pending, startTransition] = useTransition();
  const detailsHeading = useFocusOnChange<HTMLHeadingElement>(chosen?.nzbn);

  function search(e: FormEvent) {
    e.preventDefault();
    setChosen(undefined);
    startTransition(async () => setFound(await lookupBusiness(query)));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!chosen) return;
    startTransition(async () =>
      onDone(await requestVerification({ nzbn: chosen.nzbn, kind, contactName, contactRole, companyPhone, website })),
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={search} className="space-y-2">
        <h2 className="text-subtitle font-semibold">{again ? "改好资料，重新提交" : "1. 在企业登记里找到你的公司"}</h2>
        <label htmlFor="verify-query" className="block text-body font-medium">
          公司名称或 NZBN
        </label>
        <div className="flex gap-2">
          <input
            id="verify-query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="例如：Demo Yuemei 或 9429000000004"
            className="h-11 min-w-0 flex-1 rounded-md border border-border bg-surface px-3"
          />
          <button
            type="submit"
            disabled={pending || !query.trim()}
            className="h-11 rounded-md bg-brand px-4 font-medium text-white disabled:opacity-40"
          >
            查询
          </button>
        </div>
        <p className="text-meta text-muted">演示版查的是一份示例登记；正式版会连新西兰企业登记（NZBN）。</p>
      </form>

      {found?.error_zh && <p className="text-body text-warn">{found.error_zh}</p>}
      {found && found.results.length > 0 && !chosen && (
        <ul className="space-y-2">
          {found.results.map((entry) => (
            <li key={entry.nzbn} className="rounded-md border border-border bg-surface p-4">
              <p className="font-medium" lang="en">
                {entry.legalName}
              </p>
              <p className="text-body text-muted">
                NZBN {entry.nzbn} · 商号：{entry.tradingNames.join("、")}
              </p>
              <p className={`mt-1 text-body ${entry.status === "registered" ? "text-ok" : "text-danger"}`}>
                {entry.status === "registered" ? "登记状态：正常" : "登记状态：已注销"}
              </p>
              <button
                type="button"
                disabled={entry.status !== "registered" || pending}
                onClick={() => setChosen(entry)}
                className="mt-3 h-10 w-full rounded-md border border-brand text-body font-medium text-brand disabled:border-border disabled:text-muted"
              >
                这是我的公司
              </button>
            </li>
          ))}
        </ul>
      )}

      {chosen && (
        <form onSubmit={submit} className="space-y-3 rounded-md border border-border bg-surface p-4">
          <h2 ref={detailsHeading} tabIndex={-1} className="text-subtitle font-semibold outline-none">
            2. 谁在申请
          </h2>
          <p className="text-body">
            <span lang="en">{chosen.legalName}</span> · NZBN {chosen.nzbn}
            <button type="button" onClick={() => setChosen(undefined)} className="ml-2 text-meta text-brand underline">
              换一家
            </button>
          </p>
          {kinds.length > 1 && (
            <fieldset className="space-y-1">
              <legend className="text-body font-medium">申请哪个标识</legend>
              {kinds.map((k) => (
                <label key={k} className="flex items-center gap-2 text-body">
                  <input
                    type="radio"
                    name="verify-kind"
                    checked={kind === k}
                    onChange={() => setKind(k)}
                    className="accent-brand"
                  />
                  {k === "business_verified"
                    ? "已验证企业：公司在企业登记里真实存在"
                    : "认证雇主：公司在移民局公开的认证雇主名单（Accredited Employer）上"}
                </label>
              ))}
            </fieldset>
          )}
          <Field id="verify-name" label="联系人姓名" value={contactName} onChange={setContactName} />
          <Field
            id="verify-role"
            label="你在公司的职务"
            value={contactRole}
            onChange={setContactRole}
            placeholder="例如：董事、店主、经理"
          />
          <Field
            id="verify-phone"
            label="公司电话"
            value={companyPhone}
            onChange={setCompanyPhone}
            type="tel"
            hint="填公司对外公开的电话。审核员会打公开渠道查到的公司电话核实，不只打这个号码。"
          />
          <Field
            id="verify-website"
            label="网站或 Facebook 页面（选填）"
            value={website}
            onChange={setWebsite}
            type="url"
            required={false}
            placeholder="https://"
          />
          <button
            type="submit"
            disabled={pending}
            className="h-11 w-full rounded-md bg-brand font-semibold text-white disabled:opacity-40"
          >
            {pending ? "提交中…" : "提交审核"}
          </button>
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
  return (
    <section className="space-y-3 rounded-md border border-border bg-surface p-4 text-body leading-relaxed">
      <div>
        <h2 className="font-medium text-ok">「已验证企业」是什么</h2>
        <p className="mt-1">
          审核员核对了新西兰企业登记：这家公司真实存在、登记状态正常，并打公开渠道查到的公司电话，确认申请人在这家公司。职位上会显示登记的公司名称和
          NZBN。求职者更愿意联系有标识的雇主。
        </p>
      </div>
      <div>
        <h2 className="font-medium text-warn">它不代表什么</h2>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>不代表我们担保工资、工时或工作条件。</li>
          <li>「认证雇主」只说明这家公司在移民局公开的认证雇主名单上。两种标识都不代表能办理任何签证。</li>
          <li>不是对职位内容的背书。求职者遇到收费、低于最低工资等情况，仍然可以举报。</li>
        </ul>
      </div>
    </section>
  );
}
